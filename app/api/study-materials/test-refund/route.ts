import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getStudyMaterialQaConfig } from "@/lib/study-material-qa";

export const runtime = "nodejs";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type RefundData = {
  id: string;
  amount: number;
  payment_id: string;
  status: "pending" | "processed" | "failed";
};

async function razorpayRequest(
  keyId: string,
  keySecret: string,
  path: string,
  method: "GET" | "POST",
  body?: Record<string, unknown>,
  idempotencyKey?: string
) {
  const auth = Buffer.from(`${keyId}:${keySecret}`).toString("base64");
  const response = await fetch(`https://api.razorpay.com/v1/${path}`, {
    method,
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/json",
      ...(idempotencyKey ? { "X-Refund-Idempotency": idempotencyKey } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
    cache: "no-store",
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload?.error?.description || "Razorpay rejected the QA refund.");
    Object.assign(error, { status: response.status });
    throw error;
  }
  return payload as RefundData;
}

export async function POST(request: Request) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const config = getStudyMaterialQaConfig();
    if (!supabaseUrl || !supabaseKey || !serviceKey || !config.enabled || !config.webhookReady) {
      return NextResponse.json({ error: "The Razorpay QA refund service is not enabled." }, { status: 503 });
    }

    const authorization = request.headers.get("authorization");
    const token = authorization?.startsWith("Bearer ") ? authorization.slice(7) : null;
    if (!token) return NextResponse.json({ error: "Sign in to run the QA refund test." }, { status: 401 });

    const authClient = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: userData, error: authError } = await authClient.auth.getUser(token);
    if (authError || !userData.user) return NextResponse.json({ error: "Your student session is invalid." }, { status: 401 });
    if (userData.user.id !== config.qaUserId) {
      return NextResponse.json({ error: "This refund test is restricted to the QA student account." }, { status: 403 });
    }

    const body = await request.json();
    const materialId = body.materialId;
    const refundType = body.refundType;
    if (typeof materialId !== "string" || !UUID_RE.test(materialId) || !["partial", "full"].includes(refundType)) {
      return NextResponse.json({ error: "Invalid QA refund request." }, { status: 400 });
    }

    const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: order, error: orderError } = await admin
      .from("study_material_qa_payment_orders")
      .select("id,study_material_id,amount_paise,refunded_paise,status,razorpay_payment_id")
      .eq("user_id", userData.user.id)
      .eq("study_material_id", materialId)
      .not("razorpay_payment_id", "is", null)
      .order("paid_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (orderError || !order) return NextResponse.json({ error: "No verified QA payment was found." }, { status: 404 });
    if (!order.razorpay_payment_id || !["paid", "partially_refunded"].includes(order.status)) {
      return NextResponse.json({ error: "This QA payment is not eligible for another refund." }, { status: 409 });
    }

    const { data: reserved, error: reserveError } = await admin.rpc("reserve_study_material_qa_refund", {
      p_payment_order_id: order.id,
      p_refund_type: refundType,
    });
    if (reserveError || !reserved?.success || !reserved.request_id) {
      return NextResponse.json({ error: reserveError?.message || "Could not reserve this QA refund." }, { status: 409 });
    }

    const requestId = String(reserved.request_id);
    let refund: RefundData;
    try {
      if (reserved.razorpay_refund_id) {
        refund = await razorpayRequest(
          config.keyId, config.keySecret,
          `refunds/${encodeURIComponent(reserved.razorpay_refund_id)}`, "GET"
        );
      } else {
        refund = await razorpayRequest(
          config.keyId, config.keySecret,
          `payments/${encodeURIComponent(order.razorpay_payment_id)}/refund`, "POST",
          {
            amount: Number(reserved.amount_paise),
            speed: "normal",
            receipt: requestId,
            notes: {
              qa_test: "true",
              qa_refund_request_id: requestId,
              payment_order_id: order.id,
              study_material_id: materialId,
              refund_type: refundType,
            },
          },
          requestId
        );
      }
    } catch (refundError) {
      const status = typeof refundError === "object" && refundError !== null && "status" in refundError
        ? Number((refundError as { status: number }).status) : 0;
      if (status >= 400 && status < 500) {
        await admin.from("study_material_qa_refund_requests")
          .update({ status: "failed", updated_at: new Date().toISOString() })
          .eq("id", requestId).neq("status", "processed");
      }
      throw refundError;
    }

    if (!refund?.id || refund.payment_id !== order.razorpay_payment_id ||
        Number(refund.amount) !== Number(reserved.amount_paise) ||
        !["pending", "processed", "failed"].includes(refund.status)) {
      return NextResponse.json({ error: "Razorpay returned refund details that did not match the QA request." }, { status: 502 });
    }

    const requestStatus = refund.status;
    const { error: requestUpdateError } = await admin.from("study_material_qa_refund_requests")
      .update({ razorpay_refund_id: refund.id, status: requestStatus, updated_at: new Date().toISOString() })
      .eq("id", requestId).neq("status", "processed");
    if (requestUpdateError) {
      return NextResponse.json({ error: "Razorpay accepted the refund; refresh the page before retrying.", refundInitiated: true }, { status: 202 });
    }

    if (refund.status === "processed") {
      const { data: processed, error: processError } = await admin.rpc("process_study_material_qa_refund", {
        p_refund_id: refund.id,
        p_payment_id: refund.payment_id,
        p_amount_paise: refund.amount,
      });
      if (processError || !processed?.success) {
        return NextResponse.json({ error: "Razorpay processed the refund; EduAxis reconciliation is pending.", refundInitiated: true }, { status: 202 });
      }
      await admin.from("study_material_qa_refund_requests")
        .update({ status: "processed", razorpay_refund_id: refund.id, updated_at: new Date().toISOString() })
        .eq("id", requestId);
      return NextResponse.json({
        success: true,
        refundStatus: "processed",
        refundType,
        amountPaise: refund.amount,
        fullyRefunded: processed.fully_refunded,
        totalRefundedPaise: processed.total_refunded_paise,
      });
    }

    if (refund.status === "failed") {
      await admin.from("study_material_qa_refund_requests")
        .update({ status: "failed", razorpay_refund_id: refund.id, updated_at: new Date().toISOString() })
        .eq("id", requestId);
      return NextResponse.json({ error: "Razorpay marked the QA refund as failed." }, { status: 409 });
    }

    return NextResponse.json({
      success: true,
      refundStatus: "pending",
      refundType,
      amountPaise: refund.amount,
      message: "Razorpay accepted the QA refund. Access changes after the verified refund event arrives.",
    });
  } catch (error) {
    console.error("Study material QA refund error:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to process the QA refund." }, { status: 500 });
  }
}
