import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import Razorpay from "razorpay";
import { getStudyMaterialQaConfig } from "@/lib/study-material-qa";

export const runtime = "nodejs";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
    if (!token) return NextResponse.json({ error: "Please sign in to run the QA checkout." }, { status: 401 });

    const authClient = createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: userData, error: authError } = await authClient.auth.getUser(token);
    if (authError || !userData.user) {
      return NextResponse.json({ error: "Your student session is invalid." }, { status: 401 });
    }
    if (!config.qaUserId || userData.user.id !== config.qaUserId) {
      return NextResponse.json({ error: "This QA checkout is restricted to the dedicated QA student account." }, { status: 403 });
    }
    if (!config.enabled) {
      return NextResponse.json({
        error: "Razorpay test checkout is not configured yet. No payment has been initiated.",
      }, { status: 503 });
    }

    const body = await request.json();
    const materialId = body.materialId;
    if (typeof materialId !== "string" || !UUID_RE.test(materialId)) {
      return NextResponse.json({ error: "Invalid study material." }, { status: 400 });
    }

    const adminClient = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: material, error: materialError } = await adminClient
      .from("study_materials")
      .select("id,title,price,access_type,status,file_path")
      .eq("id", materialId)
      .maybeSingle();

    if (materialError || !material || material.status !== "published" || material.access_type !== "paid") {
      return NextResponse.json({ error: "This premium study material is not available." }, { status: 404 });
    }
    if (typeof material.file_path !== "string" || !material.file_path.startsWith("premium-study-materials/")) {
      return NextResponse.json({ error: "The PDF is not stored in the private premium bucket." }, { status: 409 });
    }

    const amountPaise = Math.round(Number(material.price) * 100);
    if (!Number.isSafeInteger(amountPaise) || amountPaise <= 0) {
      return NextResponse.json({ error: "The premium PDF price is invalid." }, { status: 409 });
    }

    const razorpay = new Razorpay({ key_id: config.keyId, key_secret: config.keySecret });
    const { data: existingOrder, error: existingError } = await adminClient
      .from("study_material_qa_payment_orders")
      .select("id,amount_paise,currency,razorpay_order_id,status")
      .eq("user_id", userData.user.id)
      .eq("study_material_id", materialId)
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingError) {
      return NextResponse.json({ error: "Could not check existing QA orders." }, { status: 500 });
    }

    if (existingOrder) {
      if (!existingOrder.razorpay_order_id) {
        return NextResponse.json({ error: "A QA checkout is already being prepared. Please retry in a few seconds." }, { status: 409 });
      }
      if (Number(existingOrder.amount_paise) !== amountPaise || existingOrder.currency !== "INR") {
        return NextResponse.json({ error: "The earlier QA order has a different amount. Please contact support." }, { status: 409 });
      }
      const fetched = await razorpay.orders.fetch(existingOrder.razorpay_order_id);
      if (fetched.status === "created" || fetched.status === "attempted") {
        return NextResponse.json({
          orderId: fetched.id,
          amount: fetched.amount,
          currency: fetched.currency,
          keyId: config.keyId,
          materialTitle: material.title,
          testMode: true,
        });
      }
      return NextResponse.json({ error: "The earlier QA order is no longer open. Please refresh and try again." }, { status: 409 });
    }

    const { data: orderRecord, error: recordError } = await adminClient
      .from("study_material_qa_payment_orders")
      .insert({
        user_id: userData.user.id,
        study_material_id: materialId,
        amount_paise: amountPaise,
        currency: "INR",
        status: "pending",
      })
      .select("id")
      .single();

    if (recordError || !orderRecord) {
      if (recordError?.code === "23505") {
        return NextResponse.json({ error: "Another QA checkout is already being prepared. Please retry shortly." }, { status: 409 });
      }
      console.error("QA payment order insert failed:", recordError);
      return NextResponse.json({ error: "Could not reserve the QA payment order." }, { status: 500 });
    }

    try {
      const razorpayOrder = await razorpay.orders.create({
        amount: amountPaise,
        currency: "INR",
        receipt: orderRecord.id,
        notes: {
          qa_test: "true",
          student_id: userData.user.id,
          study_material_id: materialId,
          payment_record_id: orderRecord.id,
          payment_type: "study_material_qa",
        },
      });

      const { error: updateError } = await adminClient
        .from("study_material_qa_payment_orders")
        .update({
          razorpay_order_id: razorpayOrder.id,
          updated_at: new Date().toISOString(),
        })
        .eq("id", orderRecord.id)
        .eq("status", "pending");

      if (updateError) {
        console.error("Could not save QA Razorpay order ID:", updateError);
        await adminClient
          .from("study_material_qa_payment_orders")
          .update({ status: "failed", updated_at: new Date().toISOString() })
          .eq("id", orderRecord.id)
          .eq("status", "pending");
        return NextResponse.json({ error: "Could not save the QA test order. No checkout was opened." }, { status: 500 });
      }

      return NextResponse.json({
        orderId: razorpayOrder.id,
        amount: razorpayOrder.amount,
        currency: razorpayOrder.currency,
        keyId: config.keyId,
        materialTitle: material.title,
        testMode: true,
      });
    } catch (error) {
      console.error("Razorpay QA order creation failed:", error);
      await adminClient
        .from("study_material_qa_payment_orders")
        .update({ status: "failed", updated_at: new Date().toISOString() })
        .eq("id", orderRecord.id)
        .eq("status", "pending");
      return NextResponse.json({ error: "Razorpay test mode could not create the QA order." }, { status: 502 });
    }
  } catch (error) {
    console.error("Study material QA create-order error:", error);
    return NextResponse.json({ error: "Unable to start the QA payment." }, { status: 500 });
  }
}
