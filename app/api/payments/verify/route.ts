
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
      !signature
    ) {
      return NextResponse.json(
        { error: "Payment details are incomplete." },
        { status: 400 }
      );
    }

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

    const { data: paymentRecord, error: recordError } =
      await adminClient
        .from("payment_orders")
        .select("*")
        .eq("razorpay_order_id", orderId)
        .eq("student_id", userData.user.id)
        .single();

    if (recordError || !paymentRecord) {
      return NextResponse.json(
        { error: "Payment order not found for this account." },
        { status: 404 }
      );
    }

    const razorpay = new Razorpay({
      key_id: razorpayKeyId,
      key_secret: razorpayKeySecret,
    });

    const payment = await razorpay.payments.fetch(paymentId);

    if (
      payment.order_id !== orderId ||
      payment.amount !== paymentRecord.amount_paise ||
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
          error:
            "Payment has not been captured yet. Please wait for confirmation.",
          paymentStatus: payment.status,
        },
        { status: 409 }
      );
    }

    if (paymentRecord.status === "refunded") {
      return NextResponse.json(
        { error: "This payment order has been refunded." },
        { status: 409 }
      );
    }

    if (paymentRecord.status === "paid") {
      const { data: existingPurchase } = await adminClient
        .from("mock_test_purchases")
        .select("id")
        .eq("payment_order_id", paymentRecord.id)
        .maybeSingle();

      if (existingPurchase) {
        return NextResponse.json({
          success: true,
          message: "Purchase already confirmed.",
        });
      }
    }

    const { data: otherPurchase } = await adminClient
      .from("mock_test_purchases")
      .select("id")
      .eq("student_id", userData.user.id)
      .eq("mock_test_id", paymentRecord.mock_test_id)
      .maybeSingle();

    if (otherPurchase) {
      return NextResponse.json({
        success: true,
        message: "You already have access to this test.",
      });
    }

    const { error: updateError } = await adminClient
      .from("payment_orders")
      .update({
        status: "paid",
        razorpay_payment_id: paymentId,
        paid_at: new Date().toISOString(),
      })
      .eq("id", paymentRecord.id)
      .eq("student_id", userData.user.id);

    if (updateError) {
      return NextResponse.json(
        { error: "Could not update the payment record." },
        { status: 500 }
      );
    }

    const { error: purchaseError } = await adminClient
      .from("mock_test_purchases")
      .insert({
        student_id: userData.user.id,
        mock_test_id: paymentRecord.mock_test_id,
        payment_order_id: paymentRecord.id,
      });

    if (purchaseError) {
      return NextResponse.json(
        {
          error:
            "Payment is confirmed, but access activation needs attention. Please contact support.",
          paymentConfirmed: true,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Payment verified. Your test is now unlocked.",
    });
  } catch (error) {
    console.error("Payment verification error:", error);

    return NextResponse.json(
      { error: "Unable to verify payment at this time." },
      { status: 500 }
    );
  }
}
