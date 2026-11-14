
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

    // Authenticate student.
    const authorization = request.headers.get("authorization");
    const token = authorization?.startsWith("Bearer ")
      ? authorization.slice(7)
      : null;

    if (!token) {
      return NextResponse.json(
        { error: "Please log in to purchase this course." },
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
    const courseId = body.courseId;

    if (
      typeof courseId !== "string" ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        courseId
      )
    ) {
      return NextResponse.json(
        { error: "Invalid course." },
        { status: 400 }
      );
    }

    const adminClient = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // Fetch published course and server-side price.
    const { data: course, error: courseError } = await adminClient
      .from("courses")
      .select("id, title, price, is_free, status")
      .eq("id", courseId)
      .single();

    if (courseError || !course || course.status !== "published") {
      return NextResponse.json(
        { error: "This course is not available." },
        { status: 404 }
      );
    }

    const price = Number(course.price);

    if (
      course.is_free === true ||
      !Number.isFinite(price) ||
      price <= 0
    ) {
      return NextResponse.json(
        { error: "This course is free or has no valid payment price." },
        { status: 400 }
      );
    }

    const amountPaise = Math.round(price * 100);

    if (!Number.isSafeInteger(amountPaise) || amountPaise <= 0) {
      return NextResponse.json(
        { error: "The course payment amount is invalid." },
        { status: 400 }
      );
    }

    // Check existing enrolment.
    const { data: existingEnrollment, error: enrollmentError } =
      await adminClient
        .from("course_enrollments")
        .select("id, status")
        .eq("user_id", userData.user.id)
        .eq("course_id", courseId)
        .maybeSingle();

    if (enrollmentError) {
      console.error("Enrolment lookup failed:", enrollmentError);
      return NextResponse.json(
        { error: "Could not check your course enrolment." },
        { status: 500 }
      );
    }

    if (existingEnrollment?.status === "active") {
      return NextResponse.json(
        { error: "You are already enrolled in this course." },
        { status: 409 }
      );
    }

    // Reuse an existing pending order where possible.
    const { data: pendingRecord, error: pendingError } =
      await adminClient
        .from("course_payment_orders")
        .select("id, amount_paise, currency, razorpay_order_id, status")
        .eq("user_id", userData.user.id)
        .eq("course_id", courseId)
        .eq("status", "pending")
        .not("razorpay_order_id", "is", null)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

    if (pendingError) {
      console.error("Pending course order lookup failed:", pendingError);
      return NextResponse.json(
        { error: "Could not check existing payment orders." },
        { status: 500 }
      );
    }

    const razorpay = new Razorpay({
      key_id: razorpayKeyId,
      key_secret: razorpayKeySecret,
    });

    if (pendingRecord?.razorpay_order_id) {
      if (
        Number(pendingRecord.amount_paise) !== amountPaise ||
        pendingRecord.currency !== "INR"
      ) {
        return NextResponse.json(
          { error: "An earlier payment order has a different price. Please contact support." },
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
            courseTitle: course.title,
          });
        }

        return NextResponse.json(
          { error: "An earlier payment order is no longer open. Please check your payment status before trying again." },
          { status: 409 }
        );
      } catch (error) {
        console.error("Existing Razorpay course order lookup failed:", error);
        return NextResponse.json(
          { error: "Could not verify your existing payment order." },
          { status: 502 }
        );
      }
    }

    // Create internal course payment record.
    const { data: paymentRecord, error: recordError } =
      await adminClient
        .from("course_payment_orders")
        .insert({
          user_id: userData.user.id,
          course_id: courseId,
          amount_paise: amountPaise,
          currency: "INR",
          status: "pending",
        })
        .select("id")
        .single();

    if (recordError || !paymentRecord) {
      console.error("Course payment record creation failed:", recordError);
      return NextResponse.json(
        { error: "Could not create the course payment record." },
        { status: 500 }
      );
    }

    try {
      const order = await razorpay.orders.create({
        amount: amountPaise,
        currency: "INR",
        receipt: paymentRecord.id,
        notes: {
          student_id: userData.user.id,
          course_id: courseId,
          payment_record_id: paymentRecord.id,
          payment_type: "course",
        },
      });

      const { error: updateError } = await adminClient
        .from("course_payment_orders")
        .update({
          razorpay_order_id: order.id,
          updated_at: new Date().toISOString(),
        })
        .eq("id", paymentRecord.id)
        .eq("status", "pending");

      if (updateError) {
        console.error("Saving course Razorpay order ID failed:", updateError);
        return NextResponse.json(
          { error: "Razorpay created the order, but saving it failed. Please contact support." },
          { status: 500 }
        );
      }

      return NextResponse.json({
        orderId: order.id,
        amount: order.amount,
        currency: order.currency,
        keyId: razorpayKeyId,
        courseTitle: course.title,
      });
    } catch (error) {
      console.error("Razorpay course order creation failed:", error);

      await adminClient
        .from("course_payment_orders")
        .update({
          status: "failed",
          updated_at: new Date().toISOString(),
        })
        .eq("id", paymentRecord.id)
        .eq("status", "pending");

      return NextResponse.json(
        { error: "Razorpay could not create the course payment order." },
        { status: 502 }
      );
    }
  } catch (error) {
    console.error("Course create-order error:", error);

    return NextResponse.json(
      { error: "An unexpected course payment error occurred." },
      { status: 500 }
    );
  }
}
