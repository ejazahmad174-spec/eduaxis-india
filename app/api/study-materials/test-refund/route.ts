import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getStudyMaterialQaConfig } from "@/lib/study-material-qa";

export const runtime = "nodejs";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type RefundData = {
  id: string;
  amount: number;
  payment_id: string;
  receipt?: string | null;
  notes?: Record<string, string> | null;
  status: "pending" | "processed" | "failed";
};

type RazorpayPayment = {
  id: string;
  amount: number;
  amount_refunded: number;
  status: string;
  currency: string;
};

type RefundCollection = {
  count: number;
  items: RefundData[];
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
    const error = new Error(
      payload?.error?.description || payload?.error?.reason || "Razorpay rejected the QA refund."
    );
    Object.assign(error, {
      status: response.status,
      providerCode: payload?.error?.code || null,
      providerField: payload?.error?.field || null,
      providerReason: payload?.error?.reason || null,
      providerDescription: payload?.error?.description || null,
    });
    throw error;
  }
  return payload;
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

    // Before retrying a previously failed request, reconcile directly with
    // Razorpay. A refund with the same receipt/notes may already exist even
    // when the original API response was lost or malformed.
    const { data: previousRequest, error: previousRequestError } = await admin
      .from("study_material_qa_refund_requests")
      .select("id,amount_paise,status,razorpay_refund_id")
      .eq("payment_order_id", order.id)
      .eq("refund_type", refundType)
      .maybeSingle();

    if (previousRequestError) {
      return NextResponse.json({ error: "Could not inspect the earlier QA refund attempt." }, { status: 500 });
    }

    if (previousRequest?.status === "failed" && !previousRequest.razorpay_refund_id) {
      const providerPayment = await razorpayRequest(
        config.keyId,
        config.keySecret,
        `payments/${encodeURIComponent(order.razorpay_payment_id)}`,
        "GET"
      ) as RazorpayPayment;

      if (
        providerPayment.id !== order.razorpay_payment_id ||
        providerPayment.currency !== "INR" ||
        Number(providerPayment.amount) !== Number(order.amount_paise) ||
        Number(providerPayment.amount_refunded) !== Number(order.refunded_paise) ||
        providerPayment.status !== "captured"
      ) {
        return NextResponse.json({
          error: "Razorpay payment is not in a refundable captured state. No retry was sent.",
          providerPaymentStatus: providerPayment.status,
        }, { status: 409 });
      }

      const providerRefunds = await razorpayRequest(
        config.keyId,
        config.keySecret,
        `payments/${encodeURIComponent(order.razorpay_payment_id)}/refunds?count=100`,
        "GET"
      ) as RefundCollection;

      const matchedRefund = (providerRefunds.items || []).find((item) =>
        item.receipt === previousRequest.id ||
        item.notes?.qa_refund_request_id === previousRequest.id
      );

      if (matchedRefund) {
        if (
          matchedRefund.payment_id !== order.razorpay_payment_id ||
          Number(matchedRefund.amount) !== Number(previousRequest.amount_paise)
        ) {
          return NextResponse.json({
            error: "A Razorpay refund was found, but its amount/payment does not match this QA request. Manual reconciliation is required.",
          }, { status: 409 });
        }

        const update = await admin
          .from("study_material_qa_refund_requests")
          .update({
            razorpay_refund_id: matchedRefund.id,
            status: matchedRefund.status,
            updated_at: new Date().toISOString(),
          })
          .eq("id", previousRequest.id);

        if (update.error) {
          return NextResponse.json({
            error: "Razorpay already has this refund. EduAxis could not save the provider reference; refresh status or contact support.",
            refundInitiated: true,
          }, { status: 202 });
        }

        if (matchedRefund.status === "processed") {
          const { data: reconciled, error: reconcileError } = await admin.rpc(
            "process_study_material_qa_refund",
            {
              p_refund_id: matchedRefund.id,
              p_payment_id: matchedRefund.payment_id,
              p_amount_paise: matchedRefund.amount,
            }
          );

          if (reconcileError || !reconciled?.success) {
            return NextResponse.json({
              error: "Razorpay processed the refund, but EduAxis reconciliation needs attention.",
              refundInitiated: true,
            }, { status: 202 });
          }

          await admin
            .from("study_material_qa_refund_requests")
            .update({
              status: "processed",
              updated_at: new Date().toISOString(),
            })
            .eq("id", previousRequest.id);

          return NextResponse.json({
            success: true,
            refundStatus: "processed",
            refundType,
            amountPaise: matchedRefund.amount,
            fullyRefunded: reconciled.fully_refunded,
            totalRefundedPaise: reconciled.total_refunded_paise,
            reconciledExistingRefund: true,
          });
        }

        return NextResponse.json({
          success: matchedRefund.status === "pending",
          refundStatus: matchedRefund.status,
          refundType,
          amountPaise: matchedRefund.amount,
          message: "The existing Razorpay refund was found. No duplicate refund was created.",
        }, { status: matchedRefund.status === "pending" ? 200 : 409 });
      }

      // No provider refund with this request's receipt or metadata exists.
      // The same request ID, receipt and idempotency key can now be retried.
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
        // For the final refund after a prior partial refund, omit the amount
        // so Razorpay refunds the remaining refundable balance as a full refund.
        // A fresh request ID is issued by the reservation RPC after the previous
        // rejected attempt was checked against Razorpay's refund list.
        const refundBody: Record<string, unknown> = refundType === "full"
          ? {}
          : {
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
            };

        refund = await razorpayRequest(
          config.keyId, config.keySecret,
          `payments/${encodeURIComponent(order.razorpay_payment_id)}/refund`, "POST",
          refundBody,
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
    const providerError = error as Error & {
      status?: number;
      providerCode?: string | null;
      providerField?: string | null;
      providerReason?: string | null;
      providerDescription?: string | null;
    };
    console.error("Study material QA refund error:", {
      message: providerError.message,
      status: providerError.status || null,
      code: providerError.providerCode || null,
      field: providerError.providerField || null,
      reason: providerError.providerReason || null,
      description: providerError.providerDescription || null,
    });
    return NextResponse.json({
      error: providerError.providerDescription || providerError.providerReason || providerError.message || "Unable to process the QA refund.",
      providerCode: providerError.providerCode || undefined,
      providerField: providerError.providerField || undefined,
    }, { status: providerError.status && providerError.status >= 400 && providerError.status < 500 ? 502 : 500 });
  }
}
