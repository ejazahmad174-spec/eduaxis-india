
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import Razorpay from "razorpay";

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
        { error: "Please log in to purchase this test." },
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
        { error: "Your login session is invalid. Please log in again." },
        { status: 401 }
      );
    }

    const body = await request.json();
    const mockTestId = body.mockTestId;

    if (
      typeof mockTestId !== "string" ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(mockTestId)
    ) {
      return NextResponse.json(
        { error: "Invalid mock test." },
        { status: 400 }
      );
    }

    const adminClient = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: test, error: testError } = await adminClient
      .from("mock_tests")
      .select("id, title, price, access_type, status")
      .eq("id", mockTestId)
      .single();

    if (testError || !test || test.status !== "published") {
      return NextResponse.json(
        { error: "This mock test is not available." },
        { status: 404 }
      );
    }

    if (test.access_type !== "paid") {
      return NextResponse.json(
        { error: "This test is free. No payment is required." },
        { status: 400 }
      );
    }

    const price = Number(test.price);

    if (!Number.isFinite(price) || price <= 0) {
      return NextResponse.json(
        { error: "The price for this test is not configured correctly." },
        { status: 400 }
      );
    }

    const amountPaise = Math.round(price * 100);

    const { data: existingPurchase } = await adminClient
      .from("mock_test_purchases")
      .select("id")
      .eq("student_id", userData.user.id)
      .eq("mock_test_id", mockTestId)
      .maybeSingle();

    if (existingPurchase) {
      return NextResponse.json(
        { error: "You have already purchased this test." },
        { status: 409 }
      );
    }

    const { data: paymentRecord, error: recordError } =
      await adminClient
        .from("payment_orders")
        .insert({
          student_id: userData.user.id,
          mock_test_id: mockTestId,
          amount_paise: amountPaise,
          currency: "INR",
          status: "pending",
        })
        .select("id")
        .single();

    if (recordError || !paymentRecord) {
      return NextResponse.json(
        { error: "Could not create the payment record." },
        { status: 500 }
      );
    }

    const razorpay = new Razorpay({
      key_id: razorpayKeyId,
      key_secret: razorpayKeySecret,
    });

    try {
      const order = await razorpay.orders.create({
        amount: amountPaise,
        currency: "INR",
        receipt: paymentRecord.id,
        notes: {
          student_id: userData.user.id,
          mock_test_id: mockTestId,
          payment_record_id: paymentRecord.id,
        },
      });

      const { error: updateError } = await adminClient
        .from("payment_orders")
        .update({ razorpay_order_id: order.id })
        .eq("id", paymentRecord.id);

      if (updateError) {
        return NextResponse.json(
          { error: "Could not save the payment order." },
          { status: 500 }
        );
      }

      return NextResponse.json({
        orderId: order.id,
        amount: order.amount,
        currency: order.currency,
        keyId: razorpayKeyId,
        testTitle: test.title,
      });
    } catch {
      await adminClient
        .from("payment_orders")
        .update({ status: "failed" })
        .eq("id", paymentRecord.id);

      return NextResponse.json(
        { error: "Razorpay could not create the payment order." },
        { status: 502 }
      );
    }
  } catch {
    return NextResponse.json(
      { error: "An unexpected payment error occurred." },
      { status: 500 }
    );
  }
}
