import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import Razorpay from "razorpay";
import { createHmac, timingSafeEqual } from "crypto";
import { getStudyMaterialQaConfig } from "@/lib/study-material-qa";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const config = getStudyMaterialQaConfig();

    if (!supabaseUrl || !supabaseKey || !serviceKey) {
      return NextResponse.json({ error: "QA payment service is not configured." }, { status: 503 });
    }

    const authorization = request.headers.get("authorization");
    const token = authorization?.startsWith("Bearer ") ? authorization.slice(7) : null;
    if (!token) return NextResponse.json({ error: "Please sign in again." }, { status: 401 });

    const authClient = createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: userData, error: authError } = await authClient.auth.getUser(token);
    if (authError || !userData.user) return NextResponse.json({ error: "Your student session is invalid." }, { status: 401 });
    if (!config.qaUserId || userData.user.id !== config.qaUserId) {
      return NextResponse.json({ error: "This endpoint is restricted to the QA student account." }, { status: 403 });
    }
    if (!config.enabled) {
      return NextResponse.json({ error: "Razorpay test mode is not configured." }, { status: 503 });
    }

    const body = await request.json();
    const orderId = body.razorpay_order_id;
    const paymentId = body.razorpay_payment_id;
    const signature = body.razorpay_signature;

    if (typeof orderId !== "string" || typeof paymentId !== "string" ||
        typeof signature !== "string" || !orderId || !paymentId ||
        !/^[a-f0-9]{64}$/i.test(signature)) {
      return NextResponse.json({ error: "Test payment details are incomplete or invalid." }, { status: 400 });
    }

    const expectedSignature = createHmac("sha256", config.keySecret)
      .update(`${orderId}|${paymentId}`)
      .digest("hex");
    const expectedBuffer = Buffer.from(expectedSignature, "hex");
    const receivedBuffer = Buffer.from(signature, "hex");
    if (expectedBuffer.length !== receivedBuffer.length || !timingSafeEqual(expectedBuffer, receivedBuffer)) {
      return NextResponse.json({ error: "Razorpay test payment signature verification failed." }, { status: 400 });
    }

    const adminClient = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: qaOrder, error: orderError } = await adminClient
      .from("study_material_qa_payment_orders")
      .select("*")
      .eq("razorpay_order_id", orderId)
      .eq("user_id", userData.user.id)
      .maybeSingle();

    if (orderError || !qaOrder) {
      return NextResponse.json({ error: "QA test order was not found for this student." }, { status: 404 });
    }
    if (qaOrder.status === "refunded" || qaOrder.status === "failed") {
      return NextResponse.json({ error: "This QA test order is no longer active." }, { status: 409 });
    }
    if (qaOrder.razorpay_payment_id && qaOrder.razorpay_payment_id !== paymentId) {
      return NextResponse.json({ error: "This QA order is already linked to another payment." }, { status: 409 });
    }

    const razorpay = new Razorpay({ key_id: config.keyId, key_secret: config.keySecret });
    const payment = await razorpay.payments.fetch(paymentId);

    if (
      payment.order_id !== orderId ||
      payment.amount !== Number(qaOrder.amount_paise) ||
      payment.currency !== qaOrder.currency
    ) {
      return NextResponse.json({ error: "Razorpay test payment does not match the QA order." }, { status: 400 });
    }
    if (payment.status !== "captured") {
      return NextResponse.json({
        error: "The Razorpay test payment has not been captured.",
        paymentStatus: payment.status,
      }, { status: 409 });
    }

    const { data: activation, error: activationError } = await adminClient.rpc(
      "activate_study_material_qa_payment",
      {
        p_payment_order_id: qaOrder.id,
        p_razorpay_payment_id: paymentId,
      }
    );

    if (activationError || !activation?.success) {
      console.error("QA payment activation failed:", activationError);
      return NextResponse.json({ error: "Test payment was captured, but QA access could not be activated." }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      testMode: true,
      message: "Razorpay test payment verified. QA PDF access is now available.",
      alreadyActivated: activation.already_activated ?? false,
    });
  } catch (error) {
    console.error("Study material QA verification error:", error);
    return NextResponse.json({ error: "Unable to verify the Razorpay test payment." }, { status: 500 });
  }
}
