import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import Razorpay from "razorpay";
import { createHmac, timingSafeEqual } from "crypto";
import { getStudyMaterialQaConfig } from "@/lib/study-material-qa";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const config = getStudyMaterialQaConfig();

    if (!supabaseUrl || !serviceKey || !config.webhookReady) {
      return NextResponse.json({ error: "Razorpay QA webhook is not configured." }, { status: 503 });
    }

    const rawBody = await request.text();
    const signature = request.headers.get("x-razorpay-signature");
    if (!signature || !/^[a-f0-9]{64}$/i.test(signature)) {
      return NextResponse.json({ error: "Missing or invalid QA webhook signature." }, { status: 400 });
    }

    const expected = createHmac("sha256", config.webhookSecret).update(rawBody).digest("hex");
    const expectedBuffer = Buffer.from(expected, "hex");
    const receivedBuffer = Buffer.from(signature, "hex");
    if (expectedBuffer.length !== receivedBuffer.length || !timingSafeEqual(expectedBuffer, receivedBuffer)) {
      return NextResponse.json({ error: "Invalid QA webhook signature." }, { status: 400 });
    }

    const event = JSON.parse(rawBody);
    const adminClient = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const razorpay = new Razorpay({ key_id: config.keyId, key_secret: config.keySecret });

    if (event.event === "payment.failed" || event.event === "payment.captured") {
      const paymentEntity = event?.payload?.payment?.entity;
      if (!paymentEntity?.id || !paymentEntity?.order_id) {
        return NextResponse.json({ error: "QA webhook payment details are missing." }, { status: 400 });
      }

      const { data: order, error: orderError } = await adminClient
        .from("study_material_qa_payment_orders")
        .select("id,amount_paise,currency,status,razorpay_payment_id")
        .eq("razorpay_order_id", paymentEntity.order_id)
        .maybeSingle();

      if (orderError) {
        console.error("QA webhook order lookup failed:", orderError);
        return NextResponse.json({ error: "Could not look up QA payment order." }, { status: 500 });
      }
      if (!order) return NextResponse.json({ received: true });

      if (event.event === "payment.failed") {
        if (order.status === "pending") {
          const { error } = await adminClient
            .from("study_material_qa_payment_orders")
            .update({ status: "failed", updated_at: new Date().toISOString() })
            .eq("id", order.id)
            .eq("status", "pending");
          if (error) return NextResponse.json({ error: "Could not record QA payment failure." }, { status: 500 });
        }
        return NextResponse.json({ received: true });
      }

      const payment = await razorpay.payments.fetch(paymentEntity.id);
      if (
        payment.status !== "captured" ||
        payment.order_id !== paymentEntity.order_id ||
        payment.amount !== Number(order.amount_paise) ||
        payment.currency !== order.currency ||
        (order.razorpay_payment_id && order.razorpay_payment_id !== payment.id) ||
        order.status === "refunded"
      ) {
        return NextResponse.json({ error: "QA captured payment did not match its order." }, { status: 400 });
      }

      const { error: activationError } = await adminClient.rpc(
        "activate_study_material_qa_payment",
        { p_payment_order_id: order.id, p_razorpay_payment_id: payment.id }
      );
      if (activationError) {
        console.error("QA webhook activation failed:", activationError);
        return NextResponse.json({ error: "Could not activate QA payment." }, { status: 500 });
      }
      return NextResponse.json({ received: true, success: true });
    }

    if (event.event === "refund.processed") {
      const refundEntity = event?.payload?.refund?.entity;
      if (!refundEntity?.id || !refundEntity?.payment_id || !refundEntity?.amount) {
        return NextResponse.json({ error: "QA refund details are missing." }, { status: 400 });
      }

      const refund = await razorpay.refunds.fetch(refundEntity.id);
      if (
        refund.status !== "processed" ||
        refund.id !== refundEntity.id ||
        refund.payment_id !== refundEntity.payment_id ||
        refund.amount !== Number(refundEntity.amount)
      ) {
        return NextResponse.json({ error: "QA refund could not be independently verified." }, { status: 400 });
      }

      const { data: order, error: orderError } = await adminClient
        .from("study_material_qa_payment_orders")
        .select("id")
        .eq("razorpay_payment_id", refund.payment_id)
        .maybeSingle();

      if (orderError) return NextResponse.json({ error: "Could not find QA refund order." }, { status: 500 });
      if (!order) return NextResponse.json({ received: true });

      const { data: result, error: refundError } = await adminClient.rpc(
        "process_study_material_qa_refund",
        {
          p_refund_id: refund.id,
          p_payment_id: refund.payment_id,
          p_amount_paise: refund.amount,
        }
      );

      if (refundError || !result?.success) {
        console.error("QA refund recording failed:", refundError);
        return NextResponse.json({ error: "Could not record QA refund." }, { status: 500 });
      }

      const qaRefundRequestId = refundEntity.notes?.qa_refund_request_id;
      const requestUpdate = typeof qaRefundRequestId === "string"
        ? await adminClient
            .from("study_material_qa_refund_requests")
            .update({
              status: "processed",
              razorpay_refund_id: refund.id,
              updated_at: new Date().toISOString(),
            })
            .eq("id", qaRefundRequestId)
        : await adminClient
            .from("study_material_qa_refund_requests")
            .update({
              status: "processed",
              razorpay_refund_id: refund.id,
              updated_at: new Date().toISOString(),
            })
            .eq("razorpay_refund_id", refund.id);

      if (requestUpdate.error) {
        console.error("QA refund request status update failed:", requestUpdate.error);
        return NextResponse.json({ error: "QA refund was recorded, but its request status update failed." }, { status: 500 });
      }

      return NextResponse.json({ received: true, success: true, fully_refunded: result.fully_refunded });
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Razorpay QA webhook error:", error);
    return NextResponse.json({ error: "Unable to process Razorpay QA webhook." }, { status: 500 });
  }
}
