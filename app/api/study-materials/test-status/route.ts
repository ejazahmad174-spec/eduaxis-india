import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getStudyMaterialQaConfig } from "@/lib/study-material-qa";
import Razorpay from "razorpay";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey || !serviceKey) {
      return NextResponse.json({ isQaAccount: false, enabled: false, error: "QA status is unavailable." }, { status: 503 });
    }

    const authorization = request.headers.get("authorization");
    const token = authorization?.startsWith("Bearer ") ? authorization.slice(7) : null;
    if (!token) return NextResponse.json({ error: "Sign-in is required." }, { status: 401 });

    const authClient = createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await authClient.auth.getUser(token);
    if (error || !data.user) return NextResponse.json({ error: "Student session is invalid." }, { status: 401 });

    const config = getStudyMaterialQaConfig();
    const isQaAccount = Boolean(config.qaUserId && data.user.id === config.qaUserId);
    if (!isQaAccount) {
      return NextResponse.json({ isQaAccount: false, enabled: false, webhookReady: false, purchases: [] });
    }

    const adminClient = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: orders, error: orderError } = await adminClient
      .from("study_material_qa_payment_orders")
      .select("id,study_material_id,status,amount_paise,refunded_paise,paid_at")
      .eq("user_id", data.user.id)
      .order("created_at", { ascending: false });

    if (orderError) {
      console.error("QA study material status lookup failed:", orderError);
      return NextResponse.json({ error: "QA purchase status could not be loaded." }, { status: 500 });
    }

    const qaOrders = orders || [];
    const purchases = qaOrders
      .filter((order) =>
        ["paid", "partially_refunded"].includes(order.status) &&
        Number(order.refunded_paise) < Number(order.amount_paise)
      )
      .map((order) => order.study_material_id);

    const orderIds = qaOrders.map((order) => order.id);
    const { data: refundRequests, error: refundRequestError } = orderIds.length
      ? await adminClient
          .from("study_material_qa_refund_requests")
          .select("id,payment_order_id,refund_type,amount_paise,status,razorpay_refund_id,created_at")
          .in("payment_order_id", orderIds)
          .order("created_at", { ascending: false })
      : { data: [], error: null };

    if (refundRequestError) {
      console.error("QA refund request status lookup failed:", refundRequestError);
      return NextResponse.json({ error: "QA refund status could not be loaded." }, { status: 500 });
    }

    // Refreshing QA status also checks Razorpay directly for any pending refund.
    // The provider refund is independently verified before EduAxis changes access.
    if (config.enabled && config.webhookReady && Array.isArray(refundRequests) && refundRequests.length > 0) {
      const razorpay = new Razorpay({ key_id: config.keyId, key_secret: config.keySecret });
      const orderById = new Map(qaOrders.map((order) => [order.id, order]));

      for (const refundRequest of refundRequests) {
        if (
          !["reserved", "pending"].includes(refundRequest.status) ||
          !refundRequest.razorpay_refund_id
        ) continue;

        const linkedOrder = orderById.get(refundRequest.payment_order_id);
        if (!linkedOrder) continue;

        try {
          const providerRefund = await razorpay.refunds.fetch(refundRequest.razorpay_refund_id);
          if (
            providerRefund.id !== refundRequest.razorpay_refund_id ||
            providerRefund.payment_id !== linkedOrder.razorpay_payment_id ||
            Number(providerRefund.amount) !== Number(refundRequest.amount_paise) ||
            !["pending", "processed", "failed"].includes(providerRefund.status)
          ) {
            console.error("Razorpay QA refund status did not match the reserved refund request.");
            continue;
          }

          if (providerRefund.status === "processed") {
            const { error: reconcileError } = await adminClient.rpc(
              "process_study_material_qa_refund",
              {
                p_refund_id: providerRefund.id,
                p_payment_id: providerRefund.payment_id,
                p_amount_paise: providerRefund.amount,
              }
            );

            if (reconcileError) {
              console.error("QA refund polling reconciliation failed:", reconcileError);
              continue;
            }

            const { error: requestUpdateError } = await adminClient
              .from("study_material_qa_refund_requests")
              .update({
                status: "processed",
                razorpay_refund_id: providerRefund.id,
                updated_at: new Date().toISOString(),
              })
              .eq("id", refundRequest.id);

            if (requestUpdateError) {
              console.error("QA refund polling request update failed:", requestUpdateError);
              continue;
            }
          } else if (providerRefund.status === "failed") {
            await adminClient
              .from("study_material_qa_refund_requests")
              .update({
                status: "failed",
                razorpay_refund_id: providerRefund.id,
                updated_at: new Date().toISOString(),
              })
              .eq("id", refundRequest.id)
              .neq("status", "processed");
          } else {
            await adminClient
              .from("study_material_qa_refund_requests")
              .update({ status: "pending", updated_at: new Date().toISOString() })
              .eq("id", refundRequest.id)
              .in("status", ["reserved", "pending"]);
          }
        } catch (providerError) {
          console.error("Could not refresh QA refund from Razorpay:", providerError);
        }
      }
    }

    const { data: refreshedRefundRequests, error: refreshedRefundError } = orderIds.length
      ? await adminClient
          .from("study_material_qa_refund_requests")
          .select("id,payment_order_id,refund_type,amount_paise,status,razorpay_refund_id,created_at")
          .in("payment_order_id", orderIds)
          .order("created_at", { ascending: false })
      : { data: [], error: null };

    if (refreshedRefundError) {
      console.error("QA refreshed refund status lookup failed:", refreshedRefundError);
      return NextResponse.json({ error: "QA refund status could not be refreshed." }, { status: 500 });
    }

    const { data: refreshedOrders, error: refreshedOrdersError } = orderIds.length
      ? await adminClient
          .from("study_material_qa_payment_orders")
          .select("id,study_material_id,status,amount_paise,refunded_paise,paid_at")
          .eq("user_id", data.user.id)
          .order("created_at", { ascending: false })
      : { data: [], error: null };

    if (refreshedOrdersError) {
      console.error("QA refreshed payment lookup failed:", refreshedOrdersError);
      return NextResponse.json({ error: "QA payment status could not be refreshed." }, { status: 500 });
    }

    const refreshedPurchases = (refreshedOrders || [])
      .filter((order) =>
        ["paid", "partially_refunded"].includes(order.status) &&
        Number(order.refunded_paise) < Number(order.amount_paise)
      )
      .map((order) => order.study_material_id);

    return NextResponse.json({
      isQaAccount: true,
      enabled: config.enabled,
      webhookReady: config.webhookReady,
      purchases: Array.from(new Set(refreshedPurchases)),
      qaOrders: (refreshedOrders || []).map((order) => ({
        id: order.id,
        study_material_id: order.study_material_id,
        status: order.status,
        amount_paise: Number(order.amount_paise),
        refunded_paise: Number(order.refunded_paise),
        paid_at: order.paid_at,
      })),
      refundRequests: (refreshedRefundRequests || []).map((item) => ({
        id: item.id,
        payment_order_id: item.payment_order_id,
        refund_type: item.refund_type,
        amount_paise: Number(item.amount_paise),
        status: item.status,
        razorpay_refund_id: item.razorpay_refund_id,
        created_at: item.created_at,
      })),
    });
  } catch (error) {
    console.error("QA payment status error:", error);
    return NextResponse.json({ error: "QA payment status is unavailable." }, { status: 500 });
  }
}
