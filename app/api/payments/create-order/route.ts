
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

    // Authenticate the student.
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

    // Validate the requested mock test.
    const body = await request.json();
    const mockTestId = body.mockTestId;

    if (
      typeof mockTestId !== "string" ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        mockTestId
      )
    ) {
      return NextResponse.json(
        { error: "Invalid mock test." },
        { status: 400 }
      );
    }

    const adminClient = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // Fetch the published test and its server-side price.
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

    if (!Number.isSafeInteger(amountPaise) || amountPaise <= 0) {
      return NextResponse.json(
        { error: "The payment amount is invalid." },
        { status: 400 }
      );
    }

    // Check whether the student already owns this test.
    const { data: existingPurchase, error: purchaseError } =
      await adminClient
        .from("mock_test_purchases")
        .select("id")
        .eq("student_id", userData.user.id)
        .eq("mock_test_id", mockTestId)
        .maybeSingle();

    if (purchaseError) {
      console.error("Purchase lookup failed:", purchaseError);
      return NextResponse.json(
        { error: "Could not check your purchase history." },
        { status: 500 }
      );
    }

    if (existingPurchase) {
      return NextResponse.json(
        { error: "You have already purchased this test." },
        { status: 409 }
      );
    }

    const razorpay = new Razorpay({
      key_id: razorpayKeyId,
      key_secret: razorpayKeySecret,
    });

    // Reuse the latest pending Razorpay order when it is still open.
    const { data: pendingRecord, error: pendingError } =
      await adminClient
        .from("payment_orders")
        .select("id, amount_paise, currency, razorpay_order_id, status")
        .eq("student_id", userData.user.id)
        .eq("mock_test_id", mockTestId)
        .eq("status", "pending")
        .not("razorpay_order_id", "is", null)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

    if (pendingError) {
      console.error("Pending order lookup failed:", pendingError);
      return NextResponse.json(
        { error: "Could not check existing payment orders." },
        { status: 500 }
      );
    }

    if (pendingRecord?.razorpay_order_id) {
      if (
        Number(pendingRecord.amount_paise) !== amountPaise ||
        pendingRecord.currency !== "INR"
      ) {
        return NextResponse.json(
          {
            error:
              "An earlier payment order has a different price. Please contact support.",
          },
          { status: 409 }
        );
      }

      try {
        const existingOrder = await razorpay.orders.fetch(
          pendingRecord.razorpay_order_id
        );

        if (
          existingOrder.status === "created" ||
          existingOrder.status === "attempted"
        ) {
          return NextResponse.json({
            orderId: existingOrder.id,
            amount: existingOrder.amount,
            currency: existingOrder.currency,
            keyId: razorpayKeyId,
            testTitle: test.title,
          });
        }

        // A paid or otherwise closed order must not be replaced blindly.
        return NextResponse.json(
          {
            error:
              "An earlier payment order is no longer open. Please refresh your purchase status or contact support before trying again.",
          },
          { status: 409 }
        );
      } catch (error) {
        console.error("Existing Razorpay order lookup failed:", error);

        return NextResponse.json(
          {
            error:
              "Could not verify your existing payment order. Please try again later.",
          },
          { status: 502 }
        );
      }
    }

    // Create a new internal payment record.
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
      console.error("Payment record creation failed:", recordError);
      return NextResponse.json(
        { error: "Could not create the payment record." },
        { status: 500 }
      );
    }

    try {
      // Create the Razorpay order using the server-calculated amount.
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

      // Save the Razorpay order ID in Supabase.
      const { error: updateError } = await adminClient
        .from("payment_orders")
        .update({ razorpay_order_id: order.id })
        .eq("id", paymentRecord.id)
        .eq("status", "pending");

      if (updateError) {
        console.error("Saving Razorpay order ID failed:", updateError);

        return NextResponse.json(
          {
            error:
              "Razorpay created the order, but saving it failed. Please contact support before retrying.",
          },
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
    } catch (error) {
      console.error("Razorpay order creation failed:", error);

      await adminClient
        .from("payment_orders")
        .update({ status: "failed" })
        .eq("id", paymentRecord.id)
        .eq("status", "pending");

      return NextResponse.json(
        { error: "Razorpay could not create the payment order." },
        { status: 502 }
      );
    }
  } catch (error) {
    console.error("Create payment order error:", error);

    return NextResponse.json(
      { error: "An unexpected payment error occurred." },
      { status: 500 }
    );
  }
}
