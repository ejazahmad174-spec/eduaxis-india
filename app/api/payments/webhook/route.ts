
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import Razorpay from "razorpay";
import { createHmac, timingSafeEqual } from "crypto";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const razorpayKeyId = process.env.RAZORPAY_KEY_ID;
    const razorpayKeySecret = process.env.RAZORPAY_KEY_SECRET;

    if (
      !webhookSecret ||
      !supabaseUrl ||
      !serviceKey ||
      !razorpayKeyId ||
      !razorpayKeySecret
    ) {
      return NextResponse.json(
        { error: "Webhook configuration is incomplete." },
        { status: 500 }
      );
    }

    // Verify the original Razorpay webhook request.
    const rawBody = await request.text();
    const receivedSignature =
      request.headers.get("x-razorpay-signature");

    if (
      !receivedSignature ||
      !/^[a-f0-9]{64}$/i.test(receivedSignature)
    ) {
      return NextResponse.json(
        { error: "Missing or invalid webhook signature." },
        { status: 400 }
      );
    }

    const expectedSignature = createHmac("sha256", webhookSecret)
      .update(rawBody)
      .digest("hex");

    const expectedBuffer = Buffer.from(expectedSignature, "hex");
    const receivedBuffer = Buffer.from(receivedSignature, "hex");

    if (
      expectedBuffer.length !== receivedBuffer.length ||
      !timingSafeEqual(expectedBuffer, receivedBuffer)
    ) {
      return NextResponse.json(
        { error: "Invalid webhook signature." },
        { status: 400 }
      );
    }

    const event = JSON.parse(rawBody);

    const adminClient = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const razorpay = new Razorpay({
      key_id: razorpayKeyId,
      key_secret: razorpayKeySecret,
    });

    // --------------------------------------------------
    // 1. HANDLE SUCCESSFULLY PROCESSED REFUNDS
    // --------------------------------------------------

    if (event.event === "refund.processed") {
      const refund = event?.payload?.refund?.entity;

      if (!refund?.id || !refund?.payment_id || !refund?.amount) {
        return NextResponse.json(
          { error: "Refund details are missing." },
          { status: 400 }
        );
      }

      // Independently verify the refund with Razorpay.
      const verifiedRefund = await razorpay.refunds.fetch(refund.id);

      if (
        verifiedRefund.id !== refund.id ||
        verifiedRefund.payment_id !== refund.payment_id ||
        verifiedRefund.amount !== Number(refund.amount) ||
        verifiedRefund.status !== "processed"
      ) {
        console.error("Razorpay refund verification mismatch.");

        return NextResponse.json(
          { error: "Refund details could not be verified." },
          { status: 400 }
        );
      }

      // Find the original EduAxis payment.
      const { data: order, error: orderError } = await adminClient
        .from("payment_orders")
        .select("*")
        .eq("razorpay_payment_id", verifiedRefund.payment_id)
        .maybeSingle();

      if (orderError) {
        console.error("Refund order lookup failed:", orderError);

        return NextResponse.json(
          { error: "Could not find the original payment." },
          { status: 500 }
        );
      }

      // Ignore refunds that do not belong to EduAxis India.
      if (!order) {
        return NextResponse.json({ received: true });
      }

      // Record refund and revoke access if fully refunded.
      const { data: refundResult, error: refundError } =
        await adminClient.rpc("process_mock_test_refund", {
          p_refund_id: verifiedRefund.id,
          p_payment_id: verifiedRefund.payment_id,
          p_amount_paise: verifiedRefund.amount,
        });

      if (refundError) {
        console.error("Refund processing failed:", refundError);

        return NextResponse.json(
          { error: "Refund recording failed. Retry required." },
          { status: 500 }
        );
      }

      if (!refundResult?.success) {
        return NextResponse.json(
          { error: "Refund processing could not be confirmed." },
          { status: 500 }
        );
      }

      console.log("EduAxis refund processed:", {
        refundId: verifiedRefund.id,
        paymentId: verifiedRefund.payment_id,
        fullyRefunded: refundResult.fully_refunded,
      });

      return NextResponse.json({
        received: true,
        success: true,
        fully_refunded: refundResult.fully_refunded,
        message: refundResult.message,
      });
    }

    // --------------------------------------------------
    // 2. HANDLE EXISTING PAYMENT EVENTS
    // --------------------------------------------------

    if (
      !["payment.captured", "payment.failed"].includes(event.event)
    ) {
      return NextResponse.json({ received: true });
    }

    const payment = event?.payload?.payment?.entity;

    if (!payment?.id || !payment?.order_id) {
      return NextResponse.json(
        { error: "Payment details are missing." },
        { status: 400 }
      );
    }

    const { data: order, error: orderError } = await adminClient
      .from("payment_orders")
      .select("*")
      .eq("razorpay_order_id", payment.order_id)
      .maybeSingle();

    if (orderError) {
      console.error("Webhook order lookup failed:", orderError);

      return NextResponse.json(
        { error: "Could not look up the payment order." },
        { status: 500 }
      );
    }

    if (!order) {
      return NextResponse.json({ received: true });
    }

    // A failed payment must never overwrite a successful payment.
    if (event.event === "payment.failed") {
      if (order.status === "pending") {
        const { error: updateError } = await adminClient
          .from("payment_orders")
          .update({ status: "failed" })
          .eq("id", order.id)
          .eq("status", "pending");

        if (updateError) {
          console.error("Could not record failed payment:", updateError);

          return NextResponse.json(
            { error: "Could not record payment failure." },
            { status: 500 }
          );
        }
      }

      return NextResponse.json({ received: true });
    }

    // Only captured payments can activate a purchase.
    if (payment.status !== "captured") {
      return NextResponse.json({ received: true });
    }

    if (order.status === "refunded") {
      return NextResponse.json({ received: true });
    }

    if (
      order.razorpay_payment_id &&
      order.razorpay_payment_id !== payment.id
    ) {
      console.error("Webhook payment ID mismatch.");

      return NextResponse.json(
        { error: "Payment ID does not match the order." },
        { status: 409 }
      );
    }

    // Independently confirm payment details with Razorpay.
    const verifiedPayment = await razorpay.payments.fetch(payment.id);

    if (
      verifiedPayment.status !== "captured" ||
      verifiedPayment.order_id !== order.razorpay_order_id ||
      verifiedPayment.amount !== Number(order.amount_paise) ||
      verifiedPayment.currency !== order.currency
    ) {
      console.error("Razorpay payment verification mismatch.");

      return NextResponse.json(
        { error: "Payment details do not match the order." },
        { status: 400 }
      );
    }

    const { data: activation, error: activationError } =
      await adminClient.rpc("activate_mock_test_purchase", {
        p_payment_order_id: order.id,
        p_razorpay_payment_id: payment.id,
      });

    if (activationError) {
      console.error("Webhook purchase activation failed:", activationError);

      return NextResponse.json(
        { error: "Payment received, but purchase activation needs retry." },
        { status: 500 }
      );
    }

    if (activation?.requires_review) {
      console.error("Payment requires manual purchase review:", order.id);

      return NextResponse.json(
        { error: "Payment recorded but purchase requires review." },
        { status: 500 }
      );
    }

    if (!activation?.success) {
      return NextResponse.json(
        { error: "Purchase activation could not be confirmed." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      received: true,
      success: true,
      message: activation.message,
    });
  } catch (error) {
    console.error("Razorpay webhook error:", error);

    return NextResponse.json(
      { error: "Unable to process webhook." },
      { status: 500 }
    );
  }
}
