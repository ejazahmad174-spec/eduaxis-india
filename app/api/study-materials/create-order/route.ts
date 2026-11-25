import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import Razorpay from "razorpay";

export const runtime = "nodejs";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(request: Request) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const razorpayKeyId = process.env.RAZORPAY_KEY_ID;
    const razorpayKeySecret = process.env.RAZORPAY_KEY_SECRET;

    if (!supabaseUrl || !supabaseKey || !serviceKey || !razorpayKeyId || !razorpayKeySecret) {
      return NextResponse.json({ error: "Payment configuration is incomplete." }, { status: 500 });
    }

    const authorization = request.headers.get("authorization");
    const token = authorization?.startsWith("Bearer ") ? authorization.slice(7) : null;
    if (!token) return NextResponse.json({ error: "Please log in to purchase this PDF." }, { status: 401 });

    const authClient = createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: userData, error: authError } = await authClient.auth.getUser(token);
    if (authError || !userData.user) {
      return NextResponse.json({ error: "Your login session is invalid. Please log in again." }, { status: 401 });
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

    if (materialError || !material || material.status !== "published") {
      return NextResponse.json({ error: "This study material is not available." }, { status: 404 });
    }
    if (material.access_type !== "paid") {
      return NextResponse.json({ error: "This PDF is free. No payment is required." }, { status: 400 });
    }
    if (typeof material.file_path !== "string" || !material.file_path.startsWith("premium-study-materials/")) {
      return NextResponse.json({ error: "The premium PDF file is not configured correctly. Please contact support." }, { status: 409 });
    }

    const price = Number(material.price);
    if (!Number.isFinite(price) || price <= 0) {
      return NextResponse.json({ error: "The price for this PDF is not configured correctly." }, { status: 409 });
    }
    const amountPaise = Math.round(price * 100);
    if (!Number.isSafeInteger(amountPaise) || amountPaise <= 0) {
      return NextResponse.json({ error: "The PDF payment amount is invalid." }, { status: 400 });
    }

    const { data: existingPurchase, error: purchaseError } = await adminClient
      .from("study_material_purchases")
      .select("id,payment_order_id")
      .eq("user_id", userData.user.id)
      .eq("study_material_id", materialId)
      .maybeSingle();
    if (purchaseError) {
      console.error("Study material purchase lookup failed:", purchaseError);
      return NextResponse.json({ error: "Could not check your purchase history." }, { status: 500 });
    }

    if (existingPurchase) {
      const { data: linkedOrder, error: linkedOrderError } = await adminClient
        .from("study_material_payment_orders")
        .select("status,razorpay_payment_id")
        .eq("id", existingPurchase.payment_order_id)
        .maybeSingle();
      if (linkedOrderError) {
        return NextResponse.json({ error: "Could not verify your PDF access." }, { status: 500 });
      }
      if (linkedOrder?.status === "paid" && linkedOrder.razorpay_payment_id) {
        return NextResponse.json({ error: "You have already purchased this PDF." }, { status: 409 });
      }
    }

    const razorpay = new Razorpay({ key_id: razorpayKeyId, key_secret: razorpayKeySecret });
    const { data: pendingRecord, error: pendingError } = await adminClient
      .from("study_material_payment_orders")
      .select("id,amount_paise,currency,razorpay_order_id,status")
      .eq("user_id", userData.user.id)
      .eq("study_material_id", materialId)
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (pendingError) {
      console.error("Pending PDF order lookup failed:", pendingError);
      return NextResponse.json({ error: "Could not check existing checkout requests." }, { status: 500 });
    }

    if (pendingRecord) {
      if (!pendingRecord.razorpay_order_id) {
        return NextResponse.json({ error: "A checkout is already being prepared. Please wait a few seconds and try again." }, { status: 409 });
      }
      if (Number(pendingRecord.amount_paise) !== amountPaise || pendingRecord.currency !== "INR") {
        return NextResponse.json({ error: "An earlier payment order has a different price. Please contact support." }, { status: 409 });
      }
      try {
        const existingOrder = await razorpay.orders.fetch(pendingRecord.razorpay_order_id);
        if (existingOrder.status === "created" || existingOrder.status === "attempted") {
          return NextResponse.json({
            orderId: existingOrder.id,
            amount: existingOrder.amount,
            currency: existingOrder.currency,
            keyId: razorpayKeyId,
            materialTitle: material.title,
          });
        }
        return NextResponse.json({ error: "An earlier payment order is no longer open. Please refresh your purchase status or contact support." }, { status: 409 });
      } catch (error) {
        console.error("Existing PDF Razorpay order lookup failed:", error);
        return NextResponse.json({ error: "Could not verify your existing payment order. Please try again later." }, { status: 502 });
      }
    }

    const { data: paymentRecord, error: recordError } = await adminClient
      .from("study_material_payment_orders")
      .insert({
        user_id: userData.user.id,
        study_material_id: materialId,
        amount_paise: amountPaise,
        currency: "INR",
        status: "pending",
      })
      .select("id")
      .single();

    if (recordError || !paymentRecord) {
      if (recordError?.code === "23505") {
        return NextResponse.json({ error: "A checkout request for this PDF is already in progress. Please wait and try again." }, { status: 409 });
      }
      console.error("PDF payment record creation failed:", recordError);
      return NextResponse.json({ error: "Could not create the PDF payment record." }, { status: 500 });
    }

    try {
      const order = await razorpay.orders.create({
        amount: amountPaise,
        currency: "INR",
        receipt: paymentRecord.id,
        notes: {
          student_id: userData.user.id,
          study_material_id: materialId,
          payment_record_id: paymentRecord.id,
          payment_type: "study_material",
        },
      });

      const { error: updateError } = await adminClient
        .from("study_material_payment_orders")
        .update({ razorpay_order_id: order.id, updated_at: new Date().toISOString() })
        .eq("id", paymentRecord.id)
        .eq("status", "pending");

      if (updateError) {
        console.error("Saving PDF Razorpay order ID failed:", updateError);
        await adminClient.from("study_material_payment_orders")
          .update({ status: "failed", updated_at: new Date().toISOString() })
          .eq("id", paymentRecord.id).eq("status", "pending");
        return NextResponse.json({ error: "Razorpay created an order, but EduAxis could not save its reference. No checkout was opened. Please retry." }, { status: 500 });
      }

      return NextResponse.json({
        orderId: order.id,
        amount: order.amount,
        currency: order.currency,
        keyId: razorpayKeyId,
        materialTitle: material.title,
      });
    } catch (error) {
      console.error("Razorpay PDF order creation failed:", error);
      await adminClient.from("study_material_payment_orders")
        .update({ status: "failed", updated_at: new Date().toISOString() })
        .eq("id", paymentRecord.id).eq("status", "pending");
      return NextResponse.json({ error: "Razorpay could not create the PDF payment order." }, { status: 502 });
    }
  } catch (error) {
    console.error("Study material create-order error:", error);
    return NextResponse.json({ error: "An unexpected PDF payment error occurred." }, { status: 500 });
  }
}
