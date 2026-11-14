
import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const razorpayKeyId = process.env.RAZORPAY_KEY_ID!;
const razorpayKeySecret = process.env.RAZORPAY_KEY_SECRET!;
const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET!;

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

function verifyWebhookSignature(
  body: string,
  signature: string
): boolean {
  if (!webhookSecret || !signature) return false;

  const expected = createHmac("sha256", webhookSecret)
    .update(body)
    .digest("hex");

  try {
    const expectedBuffer = Buffer.from(expected, "hex");
    const receivedBuffer = Buffer.from(signature, "hex");

    if (expectedBuffer.length !== receivedBuffer.length) {
      return false;
    }

    return timingSafeEqual(expectedBuffer, receivedBuffer);
  } catch {
    return false;
  }
}

async function razorpayGet(path: string) {
  const credentials = Buffer.from(
    `${razorpayKeyId}:${razorpayKeySecret}`
  ).toString("base64");

  const response = await fetch(
    `https://api.razorpay.com/v1/${path}`,
    {
      method: "GET",
      headers: {
        Authorization: `Basic ${credentials}`,
        "Content-Type": "application/json",
      },
      cache: "no-store",
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data?.error?.description || "Razorpay verification failed."
    );
  }

  return data;
}

export async function POST(request: NextRequest) {
  try {
    // Check required environment variables.
    if (
      !supabaseUrl ||
      !serviceRoleKey ||
      !razorpayKeyId ||
      !razorpayKeySecret ||
      !webhookSecret
    ) {
      console.error("Course webhook configuration is incomplete.");

      return NextResponse.json(
        { success: false, message: "Webhook configuration error." },
        { status: 500 }
      );
    }

    // Read the original raw request body.
    const rawBody = await request.text();

    const signature = request.headers.get(
      "x-razorpay-signature"
    );

    // Verify Razorpay webhook signature.
    if (!signature || !verifyWebhookSignature(rawBody, signature)) {
      return NextResponse.json(
        { success: false, message: "Invalid webhook signature." },
        { status: 401 }
      );
    }

    const event = JSON.parse(rawBody);

    const eventType = event?.event;
    const paymentEntity = event?.payload?.payment?.entity;
    const refundEntity = event?.payload?.refund?.entity;

    // --------------------------------------------------
    // EVENT 1: PAYMENT CAPTURED
    // --------------------------------------------------

    if (eventType === "payment.captured") {
      const paymentId = paymentEntity?.id;
      const orderId = paymentEntity?.order_id;

      if (!paymentId || !orderId) {
        return NextResponse.json({ received: true });
      }

      // Find this order only in the course payment table.
      const { data: order, error: orderError } = await supabase
        .from("course_payment_orders")
        .select("*")
        .eq("razorpay_order_id", orderId)
        .maybeSingle();

      if (orderError) {
        throw orderError;
      }

      // This event may belong to another EduAxis payment system.
      if (!order) {
        return NextResponse.json({
          received: true,
          message: "Not a course payment.",
        });
      }

      // Independently fetch the payment from Razorpay.
      const payment = await razorpayGet(
        `payments/${encodeURIComponent(paymentId)}`
      );

      // Validate the actual payment.
      if (
        payment.id !== paymentId ||
        payment.order_id !== order.razorpay_order_id ||
        Number(payment.amount) !== Number(order.amount_paise) ||
        payment.currency !== (order.currency || "INR") ||
        payment.status !== "captured"
      ) {
        console.error("Course payment verification mismatch.", {
          paymentId,
          orderId,
        });

        return NextResponse.json(
          { success: false, message: "Payment verification failed." },
          { status: 400 }
        );
      }

      if (order.status === "refunded") {
        return NextResponse.json({
          received: true,
          message: "Payment order is already refunded.",
        });
      }

      // Activate enrolment through the protected database function.
      const { data: activation, error: activationError } =
        await supabase.rpc("activate_course_enrollment", {
          p_payment_order_id: order.id,
          p_razorpay_payment_id: paymentId,
        });

      if (activationError) {
        throw activationError;
      }

      if (!activation?.success) {
        console.error("Course enrolment activation needs attention.", {
          orderId,
          paymentId,
          activation,
        });

        return NextResponse.json(
          {
            success: false,
            message: activation?.message || "Enrolment activation failed.",
          },
          { status: 500 }
        );
      }

      return NextResponse.json({
        received: true,
        success: true,
        message: "Course payment verified and enrolment processed.",
      });
    }

    // --------------------------------------------------
    // EVENT 2: PAYMENT FAILED
    // --------------------------------------------------

    if (eventType === "payment.failed") {
      const paymentId = paymentEntity?.id;
      const orderId = paymentEntity?.order_id;

      if (!orderId) {
        return NextResponse.json({ received: true });
      }

      const { data: order, error: orderError } = await supabase
        .from("course_payment_orders")
        .select("id,status")
        .eq("razorpay_order_id", orderId)
        .maybeSingle();

      if (orderError) {
        throw orderError;
      }

      if (!order) {
        return NextResponse.json({
          received: true,
          message: "Not a course payment.",
        });
      }

      // Never overwrite an already paid or refunded order.
      if (order.status === "pending") {
        const { error: updateError } = await supabase
          .from("course_payment_orders")
          .update({
            status: "failed",
            updated_at: new Date().toISOString(),
          })
          .eq("id", order.id)
          .eq("status", "pending");

        if (updateError) {
          throw updateError;
        }
      }

      return NextResponse.json({
        received: true,
        message: "Course payment failure event processed.",
        payment_id: paymentId || null,
      });
    }

    // --------------------------------------------------
    // EVENT 3: REFUND PROCESSED
    // --------------------------------------------------

    if (eventType === "refund.processed") {
      const refundId = refundEntity?.id;
      const paymentId = refundEntity?.payment_id;

      if (!refundId || !paymentId) {
        return NextResponse.json({ received: true });
      }

      // Independently fetch the refund from Razorpay.
      const refund = await razorpayGet(
        `refunds/${encodeURIComponent(refundId)}`
      );

      // Verify refund details before recording them.
      if (
        refund.id !== refundId ||
        refund.payment_id !== paymentId ||
        refund.status !== "processed" ||
        Number(refund.amount) <= 0 ||
        Number(refund.amount) !== Number(refundEntity.amount)
      ) {
        console.error("Course refund verification mismatch.", {
          refundId,
          paymentId,
        });

        return NextResponse.json(
          { success: false, message: "Refund verification failed." },
          { status: 400 }
        );
      }

      // Check whether this payment belongs to a course order.
      const { data: order, error: orderError } = await supabase
        .from("course_payment_orders")
        .select("id,amount_paise,status")
        .eq("razorpay_payment_id", paymentId)
        .maybeSingle();

      if (orderError) {
        throw orderError;
      }

      if (!order) {
        return NextResponse.json({
          received: true,
          message: "Not a course payment.",
        });
      }

      // Record refund and revoke access only after full refund.
      const { data: refundResult, error: refundError } =
        await supabase.rpc("process_course_refund", {
          p_refund_id: refundId,
          p_payment_id: paymentId,
          p_amount_paise: Number(refund.amount),
        });

      if (refundError) {
        throw refundError;
      }

      if (!refundResult?.success) {
        console.error("Course refund processing needs attention.", {
          refundId,
          paymentId,
          refundResult,
        });

        return NextResponse.json(
          {
            success: false,
            message: refundResult?.message || "Refund processing failed.",
          },
          { status: 500 }
        );
      }

      return NextResponse.json({
        received: true,
        success: true,
        fully_refunded: refundResult.fully_refunded,
        message: refundResult.message,
      });
    }

    // --------------------------------------------------
    // OTHER EVENTS
    // --------------------------------------------------

    return NextResponse.json({
      received: true,
      message: "Event not handled by the course webhook.",
    });
  } catch (error) {
    console.error("Course payment webhook error:", error);

    // A server error allows Razorpay to retry the webhook.
    return NextResponse.json(
      {
        success: false,
        message: "Course webhook processing failed.",
      },
      { status: 500 }
    );
  }
}
