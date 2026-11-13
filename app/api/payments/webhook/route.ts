
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createHmac, timingSafeEqual } from "crypto";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!webhookSecret || !supabaseUrl || !serviceKey) {
      return NextResponse.json(
        { error: "Webhook configuration is incomplete." },
        { status: 500 }
      );
    }

    // Read the original request body for signature verification.
    const rawBody = await request.text();
    const receivedSignature = request.headers.get("x-razorpay-signature");

    if (!receivedSignature) {
      return NextResponse.json(
        { error: "Missing webhook signature." },
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

    const payment = event?.payload?.payment?.entity;

    // Ignore unrelated events.
    if (!["payment.captured", "order.paid", "payment.failed"].includes(event.event)) {
      return NextResponse.json({ received: true });
    }

    if (!payment?.order_id || !payment?.id) {
      return NextResponse.json(
        { error: "Payment details are missing from the event." },
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

    // The order may not belong to EduAxis India.
    if (!order) {
      console.warn("Webhook received for an unknown order.");
      return NextResponse.json({ received: true });
    }

    // A failed payment must never overwrite an already paid order.
    if (event.event === "payment.failed") {
      if (order.status === "pending") {
        const { error } = await adminClient
          .from("payment_orders")
          .update({ status: "failed" })
          .eq("id", order.id)
          .eq("status", "pending");

        if (error) {
          console.error("Could not record failed payment:", error);
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

    if (
      payment.amount !== Number(order.amount_paise) ||
      payment.currency !== order.currency ||
      payment.order_id !== order.razorpay_order_id
    ) {
      console.error("Webhook payment amount or currency mismatch.");
      return NextResponse.json(
        { error: "Payment details do not match the order." },
        { status: 400 }
      );
    }

    if (order.status === "refunded") {
      return NextResponse.json({ received: true });
    }

    // Record the successful payment. Repeated webhook events are safe.
    const { error: updateError } = await adminClient
      .from("payment_orders")
      .update({
        status: "paid",
        razorpay_payment_id: payment.id,
        paid_at: new Date().toISOString(),
      })
      .eq("id", order.id)
      .neq("status", "refunded");

    if (updateError) {
      console.error("Could not update paid order:", updateError);
      return NextResponse.json(
        { error: "Could not update payment status." },
        { status: 500 }
      );
    }

    // Do not create a second purchase for the same student and test.
    const { data: existingPurchase, error: purchaseLookupError } =
      await adminClient
        .from("mock_test_purchases")
        .select("id")
        .eq("student_id", order.student_id)
        .eq("mock_test_id", order.mock_test_id)
        .maybeSingle();

    if (purchaseLookupError) {
      console.error("Purchase lookup failed:", purchaseLookupError);
      return NextResponse.json(
        { error: "Could not check the purchase record." },
        { status: 500 }
      );
    }

    if (!existingPurchase) {
      const { error: insertError } = await adminClient
        .from("mock_test_purchases")
        .insert({
          student_id: order.student_id,
          mock_test_id: order.mock_test_id,
          payment_order_id: order.id,
        });

      if (insertError && insertError.code !== "23505") {
        console.error("Purchase activation failed:", insertError);
        return NextResponse.json(
          { error: "Payment received, but purchase activation needs retry." },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({
      received: true,
      success: true,
    });
  } catch (error) {
    console.error("Razorpay webhook error:", error);

    return NextResponse.json(
      { error: "Unable to process webhook." },
      { status: 500 }
    );
  }
}
