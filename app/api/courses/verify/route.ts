
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import Razorpay from "razorpay";
import { createHmac, timingSafeEqual } from "crypto";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const razorpayKeyId = process.env.RAZORPAY_KEY_ID;
    const razorpayKeySecret = process.env.RAZORPAY_KEY_SECRET;

    if (
      !supabaseUrl ||
      !supabaseKey ||
      !serviceKey ||
      !razorpayKeyId ||
      !razorpayKeySecret
    ) {
      return NextResponse.json(
        { error: "Payment configuration is incomplete." },
        { status: 500 }
      );
    }

    // Authenticate student.
    const authorization = request.headers.get("authorization");
    const token = authorization?.startsWith("Bearer ")
      ? authorization.slice(7)
      : null;

    if (!token) {
      return NextResponse.json(
        { error: "Please log in again." },
        { status: 401 }
      );
    }

    const authClient = createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: userData, error: authError } =
      await authClient.auth.getUser(token);

    if (authError || !userData.user) {
      return NextResponse.json(
        { error: "Invalid login session." },
        { status: 401 }
      );
    }

    // Validate Razorpay response.
    const body = await request.json();

    const orderId = body.razorpay_order_id;
    const paymentId = body.razorpay_payment_id;
    const signature = body.razorpay_signature;

    if (
      typeof orderId !== "string" ||
      typeof paymentId !== "string" ||
      typeof signature !== "string" ||
      !orderId ||
      !paymentId ||
      !/^[a-f0-9]{64}$/i.test(signature)
    ) {
      return NextResponse.json(
        { error: "Payment details are incomplete or invalid." },
        { status: 400 }
      );
    }

    // Verify checkout signature.
    const expectedSignature = createHmac("sha256", razorpayKeySecret)
      .update(`${orderId}|${paymentId}`)
      .digest("hex");

    const expectedBuffer = Buffer.from(expectedSignature, "hex");
    const receivedBuffer = Buffer.from(signature, "hex");

    if (
      expectedBuffer.length !== receivedBuffer.length ||
      !timingSafeEqual(expectedBuffer, receivedBuffer)
    ) {
      return NextResponse.json(
        { error: "Payment signature verification failed." },
        { status: 400 }
      );
    }

    const adminClient = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // Find payment order belonging to this student.
    const { data: paymentRecord, error: recordError } =
      await adminClient
        .from("course_payment_orders")
        .select("*")
        .eq("razorpay_order_id", orderId)
        .eq("user_id", userData.user.id)
        .maybeSingle();

    if (recordError || !paymentRecord) {
      return NextResponse.json(
        { error: "Course payment order not found for this account." },
        { status: 404 }
      );
    }

    if (paymentRecord.status === "refunded") {
      return NextResponse.json(
        { error: "This payment order has been refunded." },
        { status: 409 }
      );
    }

    if (
      paymentRecord.razorpay_payment_id &&
      paymentRecord.razorpay_payment_id !== paymentId
    ) {
      return NextResponse.json(
        { error: "This order is already linked to another payment." },
        { status: 409 }
      );
    }

    // Independently verify payment with Razorpay.
    const razorpay = new Razorpay({
      key_id: razorpayKeyId,
      key_secret: razorpayKeySecret,
    });

    const payment = await razorpay.payments.fetch(paymentId);

    if (
      payment.order_id !== orderId ||
      payment.amount !== Number(paymentRecord.amount_paise) ||
      payment.currency !== paymentRecord.currency
    ) {
      return NextResponse.json(
        { error: "Payment details do not match the order." },
        { status: 400 }
      );
    }

    if (payment.status !== "captured") {
      return NextResponse.json(
        {
          error: "Payment has not been captured yet.",
          paymentStatus: payment.status,
        },
        { status: 409 }
      );
    }

    // Activate enrolment through the secure database function.
    const { data: activation, error: activationError } =
      await adminClient.rpc("activate_course_enrollment", {
        p_payment_order_id: paymentRecord.id,
        p_razorpay_payment_id: paymentId,
      });

    if (activationError) {
      console.error("Course enrolment activation failed:", activationError);

      return NextResponse.json(
        {
          error:
            "Payment was captured, but course access activation needs attention. Please contact support.",
          paymentConfirmed: true,
        },
        { status: 500 }
      );
    }

    if (activation?.requires_review) {
      return NextResponse.json(
        {
          success: false,
          paymentConfirmed: true,
          requiresReview: true,
          error: "Payment requires manual review. Please contact support.",
        },
        { status: 409 }
      );
    }

    if (!activation?.success) {
      return NextResponse.json(
        {
          error: "Course enrolment activation could not be confirmed.",
          paymentConfirmed: true,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: activation.message,
      alreadyActivated: activation.already_activated ?? false,
    });
  } catch (error) {
    console.error("Course payment verification error:", error);

    return NextResponse.json(
      { error: "Unable to verify course payment at this time." },
      { status: 500 }
    );
  }
}
