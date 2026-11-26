import { NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "crypto";
import { getStudyMaterialQaConfig } from "@/lib/study-material-qa";
import { notifyStudentOfRefund } from "@/lib/refund-notifications";

export const runtime = "nodejs";

type RefundCategory = "mock_test" | "course" | "study_material" | "qa_study_material";
type RefundType = "partial" | "full";

type QueuedRefundAction = {
  id: string;
  category: RefundCategory;
  payment_order_id: string;
  student_id: string;
  razorpay_payment_id: string;
  mode: "live" | "test";
  refund_type: RefundType;
  amount_paise: number;
  reason: string;
  request_source: string;
  status: string;
  razorpay_refund_id: string | null;
};

type RazorpayPayment = {
  id: string;
  order_id: string;
  amount: number;
  amount_refunded: number;
  currency: string;
  status: string;
};

type RazorpayRefund = {
  id: string;
  payment_id: string;
  amount: number;
  currency: string;
  status: "pending" | "processed" | "failed";
  notes?: Record<string, string> | null;
  receipt?: string | null;
  created_at?: number;
};

type RefundLedgerRow = {
  payment_order_id: string;
  razorpay_refund_id: string;
  razorpay_payment_id: string;
  amount_paise: number;
  status: string;
  created_at: string;
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

async function getAdminContext(request: Request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey || !serviceKey) {
    throw new Error("Refund management is not configured.");
  }

  const authorization = request.headers.get("authorization");
  const token = authorization?.startsWith("Bearer ") ? authorization.slice(7) : null;
  if (!token) {
    return { response: jsonError("Administrator sign-in is required.", 401) };
  }

  const authClient = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: authData, error: authError } = await authClient.auth.getUser(token);
  if (authError || !authData.user) {
    return { response: jsonError("Your administrator session is invalid.", 401) };
  }

  const adminClient = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: profile, error: profileError } = await adminClient
    .from("profiles")
    .select("role")
    .eq("id", authData.user.id)
    .maybeSingle();

  if (profileError || profile?.role !== "admin") {
    return { response: jsonError("You are not authorised to manage refunds.", 403) };
  }

  return { adminClient, userId: authData.user.id };
}

function money(paise: number) {
  return (Number(paise || 0) / 100).toLocaleString("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

async function razorpayRequest(
  keyId: string,
  keySecret: string,
  path: string,
  method: "GET" | "POST",
  body?: Record<string, unknown>,
  idempotencyKey?: string,
) {
  const authorization = Buffer.from(`${keyId}:${keySecret}`).toString("base64");
  const response = await fetch(`https://api.razorpay.com/v1/${path}`, {
    method,
    headers: {
      Authorization: `Basic ${authorization}`,
      "Content-Type": "application/json",
      ...(idempotencyKey ? { "X-Refund-Idempotency": idempotencyKey } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
    cache: "no-store",
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(
      payload?.error?.description ||
      payload?.error?.reason ||
      "Razorpay rejected the refund request.",
    ) as Error & { status?: number; code?: string };
    error.status = response.status;
    error.code = payload?.error?.code || payload?.error?.reason || "RAZORPAY_ERROR";
    throw error;
  }
  return payload;
}

function paymentConfig(category: RefundCategory) {
  if (category === "qa_study_material") {
    const qa = getStudyMaterialQaConfig();
    if (!qa.enabled || !qa.webhookReady || !qa.keyId.startsWith("rzp_test_")) {
      throw new Error("Razorpay QA Test Mode is not fully configured.");
    }
    return { keyId: qa.keyId, keySecret: qa.keySecret, mode: "test" as const };
  }

  const keyId = process.env.RAZORPAY_KEY_ID || "";
  const keySecret = process.env.RAZORPAY_KEY_SECRET || "";
  if (!keyId.startsWith("rzp_live_") || !keySecret) {
    throw new Error("Live Razorpay credentials are unavailable or are not Live Mode credentials.");
  }
  return { keyId, keySecret, mode: "live" as const };
}

async function processRefundLedger(
  adminClient: SupabaseClient,
  category: RefundCategory,
  refund: RazorpayRefund,
) {
  const rpcName = category === "mock_test"
    ? "process_mock_test_refund"
    : category === "course"
      ? "process_course_refund"
      : category === "study_material"
        ? "process_study_material_refund"
        : "process_study_material_qa_refund";

  const { data, error } = await adminClient.rpc(rpcName, {
    p_refund_id: refund.id,
    p_payment_id: refund.payment_id,
    p_amount_paise: Number(refund.amount),
  });

  if (error) throw error;
  if (!data?.success) {
    throw new Error(data?.message || "Refund was verified by Razorpay but could not be recorded in EduAxis.");
  }
  return data as { success: boolean; fully_refunded?: boolean; total_refunded_paise?: number; message?: string };
}

async function getOrder(
  adminClient: SupabaseClient,
  category: RefundCategory,
  orderId: string,
) {
  const table = category === "mock_test"
    ? "payment_orders"
    : category === "course"
      ? "course_payment_orders"
      : category === "study_material"
        ? "study_material_payment_orders"
        : "study_material_qa_payment_orders";

  const { data, error } = await adminClient
    .from(table)
    .select("*")
    .eq("id", orderId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  const studentId = category === "mock_test" ? data.student_id : data.user_id;
  const productId = category === "mock_test"
    ? data.mock_test_id
    : category === "course"
      ? data.course_id
      : data.study_material_id;

  const productTable = category === "mock_test"
    ? "mock_tests"
    : category === "course"
      ? "courses"
      : "study_materials";

  const { data: product, error: productError } = await adminClient
    .from(productTable)
    .select("title")
    .eq("id", productId)
    .maybeSingle();

  if (productError) throw productError;

  const { data: profile, error: profileError } = await adminClient
    .from("profiles")
    .select("full_name,email")
    .eq("id", studentId)
    .maybeSingle();

  if (profileError) throw profileError;

  return {
    id: data.id as string,
    studentId: studentId as string,
    studentName: profile?.full_name || "Student",
    studentEmail: profile?.email || null,
    title: product?.title || "EduAxis India resource",
    paymentId: data.razorpay_payment_id as string | null,
    orderId: data.razorpay_order_id as string | null,
    amountPaise: Number(data.amount_paise),
    currency: data.currency || "INR",
    status: data.status as string,
    paidAt: data.paid_at as string | null,
  };
}

async function getRecordedRefunds(
  adminClient: SupabaseClient,
  category: RefundCategory,
  orderId: string,
): Promise<RefundLedgerRow[]> {
  const table = category === "mock_test"
    ? "payment_refunds"
    : category === "course"
      ? "course_payment_refunds"
      : category === "study_material"
        ? "study_material_payment_refunds"
        : "study_material_qa_payment_refunds";

  const { data, error } = await adminClient
    .from(table)
    .select("payment_order_id,razorpay_refund_id,razorpay_payment_id,amount_paise,status,created_at")
    .eq("payment_order_id", orderId);

  if (error) throw error;
  return (data || []) as RefundLedgerRow[];
}

async function getProductsAndOrders(adminClient: SupabaseClient) {
  const [
    mockOrders, mockRefunds, mockTests,
    courseOrders, courseRefunds, courses,
    materialOrders, materialRefunds, materials,
    qaOrders, qaRefunds,
    actions,
  ] = await Promise.all([
    adminClient.from("payment_orders").select("id,student_id,mock_test_id,amount_paise,currency,status,razorpay_payment_id,created_at,paid_at").in("status", ["paid", "refunded"]).not("razorpay_payment_id", "is", null).order("paid_at", { ascending: false }).range(0, 249),
    adminClient.from("payment_refunds").select("payment_order_id,razorpay_refund_id,amount_paise,status,processed_at,created_at").eq("status", "processed"),
    adminClient.from("mock_tests").select("id,title"),
    adminClient.from("course_payment_orders").select("id,user_id,course_id,amount_paise,currency,status,razorpay_payment_id,created_at,paid_at").in("status", ["paid", "refunded"]).not("razorpay_payment_id", "is", null).order("paid_at", { ascending: false }).range(0, 249),
    adminClient.from("course_payment_refunds").select("payment_order_id,razorpay_refund_id,amount_paise,status,created_at").eq("status", "processed"),
    adminClient.from("courses").select("id,title"),
    adminClient.from("study_material_payment_orders").select("id,user_id,study_material_id,amount_paise,currency,status,razorpay_payment_id,created_at,paid_at").in("status", ["paid", "refunded"]).not("razorpay_payment_id", "is", null).order("paid_at", { ascending: false }).range(0, 249),
    adminClient.from("study_material_payment_refunds").select("payment_order_id,razorpay_refund_id,amount_paise,status,created_at").eq("status", "processed"),
    adminClient.from("study_materials").select("id,title"),
    adminClient.from("study_material_qa_payment_orders").select("id,user_id,study_material_id,amount_paise,currency,status,razorpay_payment_id,refunded_paise,created_at,paid_at").not("razorpay_payment_id", "is", null).order("paid_at", { ascending: false }).range(0, 249),
    adminClient.from("study_material_qa_payment_refunds").select("payment_order_id,razorpay_refund_id,amount_paise,created_at"),
    adminClient.from("admin_refund_actions").select("id,category,payment_order_id,student_id,amount_paise,refund_type,status,razorpay_refund_id,reason,mode,provider_error_code,provider_error,created_at,processed_at").order("created_at", { ascending: false }).limit(150),
  ]);

  const allResults = [
    mockOrders, mockRefunds, mockTests,
    courseOrders, courseRefunds, courses,
    materialOrders, materialRefunds, materials,
    qaOrders, qaRefunds, actions,
  ];
  const queryErrors = allResults.filter((result) => result.error);
  if (queryErrors.length) {
    console.error("Admin refund queue query failed:", queryErrors.map((result) => result.error));
    throw new Error("Some payment records could not be loaded. Please refresh.");
  }

  const mockOrderRows = mockOrders.data || [];
  const courseOrderRows = courseOrders.data || [];
  const materialOrderRows = materialOrders.data || [];
  const qaOrderRows = qaOrders.data || [];
  const userIds = Array.from(new Set([
    ...mockOrderRows.map((order) => order.student_id),
    ...courseOrderRows.map((order) => order.user_id),
    ...materialOrderRows.map((order) => order.user_id),
    ...qaOrderRows.map((order) => order.user_id),
  ].filter(Boolean) as string[]));

  const { data: profiles, error: profileError } = userIds.length
    ? await adminClient.from("profiles").select("id,full_name,email").in("id", userIds)
    : { data: [], error: null };
  if (profileError) throw profileError;

  const profileMap = new Map((profiles || []).map((profile) => [profile.id, profile]));
  const mockTitleMap = new Map((mockTests.data || []).map((item) => [item.id, item.title]));
  const courseTitleMap = new Map((courses.data || []).map((item) => [item.id, item.title]));
  const materialTitleMap = new Map((materials.data || []).map((item) => [item.id, item.title]));

  const refundsByCategory = {
    mock_test: new Map<string, number>(),
    course: new Map<string, number>(),
    study_material: new Map<string, number>(),
    qa_study_material: new Map<string, number>(),
  };

  const fillRefundTotals = (category: RefundCategory, rows: Array<{ payment_order_id: string; amount_paise: number }>) => {
    for (const row of rows) {
      const map = refundsByCategory[category];
      map.set(row.payment_order_id, (map.get(row.payment_order_id) || 0) + Number(row.amount_paise || 0));
    }
  };

  fillRefundTotals("mock_test", mockRefunds.data || []);
  fillRefundTotals("course", courseRefunds.data || []);
  fillRefundTotals("study_material", materialRefunds.data || []);
  fillRefundTotals("qa_study_material", qaRefunds.data || []);

  const orders = [
    ...mockOrderRows.map((order) => {
      const student = profileMap.get(order.student_id);
      const refunded = refundsByCategory.mock_test.get(order.id) || 0;
      return {
        id: order.id,
        category: "mock_test" as const,
        category_label: "Mock Test",
        title: mockTitleMap.get(order.mock_test_id) || "Mock Test",
        student_id: order.student_id,
        student_name: student?.full_name || "Student",
        student_email: student?.email || null,
        amount_paise: Number(order.amount_paise),
        refunded_paise: refunded,
        remaining_paise: Math.max(0, Number(order.amount_paise) - refunded),
        status: order.status,
        payment_id: order.razorpay_payment_id,
        paid_at: order.paid_at || order.created_at,
        mode: "live" as const,
      };
    }),
    ...courseOrderRows.map((order) => {
      const student = profileMap.get(order.user_id);
      const refunded = refundsByCategory.course.get(order.id) || 0;
      return {
        id: order.id,
        category: "course" as const,
        category_label: "Course",
        title: courseTitleMap.get(order.course_id) || "Course",
        student_id: order.user_id,
        student_name: student?.full_name || "Student",
        student_email: student?.email || null,
        amount_paise: Number(order.amount_paise),
        refunded_paise: refunded,
        remaining_paise: Math.max(0, Number(order.amount_paise) - refunded),
        status: order.status,
        payment_id: order.razorpay_payment_id,
        paid_at: order.paid_at || order.created_at,
        mode: "live" as const,
      };
    }),
    ...materialOrderRows.map((order) => {
      const student = profileMap.get(order.user_id);
      const refunded = refundsByCategory.study_material.get(order.id) || 0;
      return {
        id: order.id,
        category: "study_material" as const,
        category_label: "Study Material",
        title: materialTitleMap.get(order.study_material_id) || "Study Material",
        student_id: order.user_id,
        student_name: student?.full_name || "Student",
        student_email: student?.email || null,
        amount_paise: Number(order.amount_paise),
        refunded_paise: refunded,
        remaining_paise: Math.max(0, Number(order.amount_paise) - refunded),
        status: order.status,
        payment_id: order.razorpay_payment_id,
        paid_at: order.paid_at || order.created_at,
        mode: "live" as const,
      };
    }),
    ...qaOrderRows.map((order) => {
      const student = profileMap.get(order.user_id);
      const refunded = refundsByCategory.qa_study_material.get(order.id) || Number(order.refunded_paise || 0);
      return {
        id: order.id,
        category: "qa_study_material" as const,
        category_label: "QA Test PDF",
        title: materialTitleMap.get(order.study_material_id) || "QA PDF",
        student_id: order.user_id,
        student_name: student?.full_name || "QA Student",
        student_email: student?.email || null,
        amount_paise: Number(order.amount_paise),
        refunded_paise: refunded,
        remaining_paise: Math.max(0, Number(order.amount_paise) - refunded),
        status: order.status,
        payment_id: order.razorpay_payment_id,
        paid_at: order.paid_at || order.created_at,
        mode: "test" as const,
      };
    }),
  ].sort((a, b) => new Date(b.paid_at).getTime() - new Date(a.paid_at).getTime());

  return {
    generatedAt: new Date().toISOString(),
    orders,
    actions: actions.data || [],
    emailConfigured: Boolean(process.env.RESEND_API_KEY && process.env.RESEND_FROM_EMAIL),
  };
}

export async function GET(request: Request) {
  try {
    const context = await getAdminContext(request);
    if ("response" in context) return context.response;
    const payload = await getProductsAndOrders(context.adminClient);
    return NextResponse.json(payload, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Admin refunds GET error:", error);
    return jsonError(error instanceof Error ? error.message : "Refund data could not be loaded.", 500);
  }
}

export async function POST(request: Request) {
  let adminClient: SupabaseClient | null = null;
  let actionId: string | null = null;

  try {
    const context = await getAdminContext(request);
    if ("response" in context) return context.response;
    adminClient = context.adminClient;

    const body = await request.json();
    const retryActionId = typeof body.retryActionId === "string" && UUID_RE.test(body.retryActionId)
      ? body.retryActionId
      : null;

    let retryAction: QueuedRefundAction | null = null;

    if (retryActionId) {
      const { data, error } = await adminClient
        .from("admin_refund_actions")
        .select("id,category,payment_order_id,student_id,razorpay_payment_id,mode,refund_type,amount_paise,reason,request_source,status,razorpay_refund_id")
        .eq("id", retryActionId)
        .maybeSingle();

      if (error || !data) return jsonError("The queued refund action could not be found.", 404);
      if (data.status !== "awaiting_funds" || data.razorpay_refund_id) {
        return jsonError("Only a refund explicitly waiting for funds can be retried. Refresh the refund history first.", 409);
      }
      retryAction = data as QueuedRefundAction;
    }

    const category = (retryAction?.category || body.category) as RefundCategory;
    const paymentOrderId = retryAction?.payment_order_id || body.paymentOrderId;
    const refundType = (retryAction?.refund_type || body.refundType) as RefundType;
    const amountInput = retryAction ? retryAction.amount_paise : body.amountPaise;
    const reason = retryAction?.reason || (typeof body.reason === "string" ? body.reason.trim() : "");
    const requestSource = retryAction?.request_source ||
      (["student_email", "admin_initiated", "support_email", "other"].includes(body.requestSource)
        ? body.requestSource
        : "student_email");

    if (
      !["mock_test", "course", "study_material", "qa_study_material"].includes(category) ||
      typeof paymentOrderId !== "string" || !UUID_RE.test(paymentOrderId) ||
      !["partial", "full"].includes(refundType) ||
      reason.length < 3 || reason.length > 1000
    ) {
      return jsonError("Enter a valid payment, refund type and reason.", 400);
    }

    const order = await getOrder(adminClient, category, paymentOrderId);
    if (!order) return jsonError("The selected payment order was not found.", 404);
    if (!order.paymentId || !order.orderId) return jsonError("This purchase does not have a verified Razorpay payment.", 409);
    if (!["paid", "partially_refunded"].includes(order.status)) {
      return jsonError("Only paid purchases with an outstanding balance can be refunded.", 409);
    }

    const credentials = paymentConfig(category);
    if (retryAction && retryAction.mode !== credentials.mode) {
      return jsonError("The queued refund mode does not match the configured Razorpay credentials. Manual review is required.", 409);
    }

    if (retryAction && (retryAction.student_id !== order.studentId || retryAction.razorpay_payment_id !== order.paymentId)) {
      return jsonError("The queued refund no longer matches the original purchase. Manual review is required.", 409);
    }

    const providerPayment = await razorpayRequest(
      credentials.keyId,
      credentials.keySecret,
      `payments/${encodeURIComponent(order.paymentId)}`,
      "GET",
    ) as RazorpayPayment;

    if (
      providerPayment.id !== order.paymentId ||
      providerPayment.order_id !== order.orderId ||
      providerPayment.currency !== order.currency ||
      Number(providerPayment.amount) !== order.amountPaise ||
      providerPayment.status !== "captured"
    ) {
      return jsonError("Razorpay payment details do not match this EduAxis purchase. No refund was started.", 409);
    }

    const providerRefunds = await razorpayRequest(
      credentials.keyId,
      credentials.keySecret,
      `payments/${encodeURIComponent(order.paymentId)}/refunds?count=100`,
      "GET",
    ) as { items?: RazorpayRefund[] };

    const providerRefundRows = Array.isArray(providerRefunds.items) ? providerRefunds.items : [];
    if (providerRefundRows.length >= 100) {
      return jsonError("This payment has a long refund history. Please reconcile it manually before issuing another refund.", 409);
    }
    if (providerRefundRows.some((refund) => refund.status === "pending")) {
      return jsonError("A previous refund is still processing at Razorpay. Refresh the queue and retry after it reaches a final status.", 409);
    }

    // Reconcile every provider-confirmed refund before calculating the remaining balance.
    for (const providerRefund of providerRefundRows) {
      if (providerRefund.status !== "processed") continue;
      await processRefundLedger(adminClient, category, providerRefund);
    }

    const providerRefundedPaise = providerRefundRows
      .filter((refund) => refund.status === "processed")
      .reduce((total, refund) => total + Number(refund.amount || 0), 0);

    if (providerRefundedPaise > providerPayment.amount) {
      return jsonError("Razorpay refund history exceeds the original captured amount. Manual review is required.", 409);
    }

    if (Number(providerPayment.amount_refunded || 0) !== providerRefundedPaise) {
      return jsonError("Razorpay's refunded total does not match its refund list. Please refresh and contact support before proceeding.", 409);
    }

    const remainingPaise = providerPayment.amount - providerRefundedPaise;
    if (remainingPaise < 100) return jsonError("This payment has no refundable balance remaining.", 409);

    const refundAmountPaise = retryAction
      ? Number(retryAction.amount_paise)
      : refundType === "full"
        ? remainingPaise
        : Number(amountInput);

    if (
      !Number.isSafeInteger(refundAmountPaise) ||
      refundAmountPaise < 100 ||
      refundAmountPaise > remainingPaise ||
      (!retryAction && refundType === "partial" && refundAmountPaise >= remainingPaise)
    ) {
      if (retryAction) {
        await adminClient.from("admin_refund_actions").update({
          status: "review_required",
          provider_error: "The purchase was refunded through another route after this request was queued. Verify the remaining payable balance before taking further action.",
          updated_at: new Date().toISOString(),
        }).eq("id", retryAction.id);
      }
      return jsonError(
        retryAction
          ? "The queued amount no longer fits the remaining refundable balance. The action has been moved to manual review."
          : "The refund amount must be at least ₹1 and cannot exceed the remaining payment balance. Use Full refund for the complete balance.",
        409,
      );
    }

    const idempotencyKey = randomUUID();
    let action: { id: string };

    if (retryAction) {
      const { data: claimedAction, error: claimError } = await adminClient
        .from("admin_refund_actions")
        .update({
          status: "initiating",
          idempotency_key: idempotencyKey,
          provider_error_code: null,
          provider_error: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", retryAction.id)
        .eq("status", "awaiting_funds")
        .is("razorpay_refund_id", null)
        .select("id")
        .maybeSingle();

      if (claimError || !claimedAction) {
        return jsonError("This queued refund is already being retried or is no longer eligible. Refresh the refund history.", 409);
      }
      action = claimedAction;
    } else {
      const actionUuid = randomUUID();
      const { data: createdAction, error: actionError } = await adminClient
        .from("admin_refund_actions")
        .insert({
          id: actionUuid,
          category,
          payment_order_id: order.id,
          student_id: order.studentId,
          razorpay_payment_id: order.paymentId,
          mode: credentials.mode,
          refund_type: refundType,
          amount_paise: refundAmountPaise,
          currency: order.currency,
          reason,
          request_source: requestSource,
          source_reference: typeof body.sourceReference === "string" ? body.sourceReference.trim().slice(0, 180) : null,
          status: "initiating",
          idempotency_key: idempotencyKey,
          initiated_by: context.userId,
        })
        .select("id")
        .single();

      if (actionError || !createdAction) {
        console.error("Could not create admin refund audit action:", actionError);
        return jsonError("The refund action could not be saved. No provider request was sent.", 500);
      }
      action = createdAction;
    }

    actionId = action.id;

    const refundPayload = {
      amount: refundAmountPaise,
      speed: "normal",
      receipt: action.id,
      notes: {
        eduaxis_refund_action_id: action.id,
        eduaxis_category: category,
        eduaxis_payment_order_id: order.id,
        eduaxis_mode: credentials.mode,
      },
    };

    let providerRefund: RazorpayRefund;
    try {
      providerRefund = await razorpayRequest(
        credentials.keyId,
        credentials.keySecret,
        `payments/${encodeURIComponent(order.paymentId)}/refund`,
        "POST",
        refundPayload,
        idempotencyKey,
      ) as RazorpayRefund;
    } catch (providerError) {
      const error = providerError as Error & { status?: number; code?: string };
      const normalizedDescription = (error.message || "").toLowerCase();
      const insufficientBalance =
        error.status === 400 &&
        (
          /not enough balance/.test(normalizedDescription) ||
          /does not have enough balance/.test(normalizedDescription) ||
          /insufficient (merchant )?balance/.test(normalizedDescription) ||
          /merchant.{0,80}balance.{0,40}lower than.{0,40}refund amount/.test(normalizedDescription) ||
          /insufficient funds to carry out the refund/.test(normalizedDescription)
        );

      if (insufficientBalance) {
        const { error: queueError } = await adminClient
          .from("admin_refund_actions")
          .update({
            status: "awaiting_funds",
            razorpay_refund_id: null,
            provider_error_code: error.code || "INSUFFICIENT_BALANCE",
            provider_error: error.message.slice(0, 1000),
            updated_at: new Date().toISOString(),
          })
          .eq("id", action.id);

        if (queueError) {
          console.error("Refund could not be queued after Razorpay reported insufficient balance:", queueError);
          await adminClient.from("admin_refund_actions").update({
            status: "review_required",
            provider_error: "Razorpay reported insufficient balance, but EduAxis could not safely save the Awaiting funds status. Check Razorpay before retrying.",
            updated_at: new Date().toISOString(),
          }).eq("id", action.id);
          return NextResponse.json({
            error: "Razorpay did not process the refund and EduAxis could not save its queue status. Manual review is required.",
            actionId: action.id,
            status: "review_required",
          }, { status: 202 });
        }

        const notification = await notifyStudentOfRefund(adminClient, {
          studentId: order.studentId,
          studentEmail: order.studentEmail,
          refundId: action.id,
          status: "awaiting_funds",
          amountPaise: refundAmountPaise,
          productTitle: order.title,
          categoryLabel: category === "qa_study_material" ? "QA Test PDF" : category === "mock_test" ? "Mock Test" : category === "course" ? "Course" : "Study Material",
          orderReference: order.id,
        });

        return NextResponse.json({
          success: true,
          actionId: action.id,
          status: "awaiting_funds",
          amountPaise: refundAmountPaise,
          notification,
          message: `Razorpay has not processed this refund because the merchant balance is insufficient. The full ${money(refundAmountPaise)} request is saved as Awaiting funds. Retry it after sufficient funds become available.`,
        }, { status: 200 });
      }

      const deterministicFailure = Boolean(error.status && error.status >= 400 && error.status < 500);
      await adminClient
        .from("admin_refund_actions")
        .update({
          status: deterministicFailure ? "failed" : "review_required",
          provider_error_code: error.code || null,
          provider_error: error.message.slice(0, 1000),
          updated_at: new Date().toISOString(),
        })
        .eq("id", action.id);
      return NextResponse.json({
        error: error.message || "Razorpay could not initiate the refund.",
        actionId: action.id,
        status: deterministicFailure ? "failed" : "review_required",
      }, { status: deterministicFailure ? 502 : 202 });
    }

    if (
      !providerRefund?.id ||
      providerRefund.payment_id !== order.paymentId ||
      Number(providerRefund.amount) !== refundAmountPaise ||
      !["pending", "processed", "failed"].includes(providerRefund.status)
    ) {
      await adminClient
        .from("admin_refund_actions")
        .update({
          status: "review_required",
          provider_error: "Razorpay returned refund details that did not match the initiated request.",
          updated_at: new Date().toISOString(),
        })
        .eq("id", action.id);
      return NextResponse.json({
        error: "Razorpay returned refund details that do not match. The action is marked for manual review.",
        actionId: action.id,
        status: "review_required",
      }, { status: 202 });
    }

    const { error: initialAuditUpdateError } = await adminClient
      .from("admin_refund_actions")
      .update({
        razorpay_refund_id: providerRefund.id,
        status: providerRefund.status,
        processed_at: providerRefund.status === "processed" ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", action.id);

    let finalStatus: "processed" | "pending" | "failed" | "review_required" = providerRefund.status;
    let totalRefundedPaise = providerRefundRefundedTotal(providerRefundRows, providerRefund);
    let auditNeedsReview = Boolean(initialAuditUpdateError);

    if (initialAuditUpdateError) {
      console.error("Razorpay accepted the refund but the first admin audit update failed:", initialAuditUpdateError);
    }

    if (providerRefund.status === "processed") {
      try {
        const processed = await processRefundLedger(adminClient, category, providerRefund);
        totalRefundedPaise = Number(processed.total_refunded_paise || (providerRefundedPaise + refundAmountPaise));
        const { error: processedAuditError } = await adminClient
          .from("admin_refund_actions")
          .update({ status: "processed", processed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
          .eq("id", action.id);
        if (processedAuditError) {
          auditNeedsReview = true;
          console.error("Product refund ledger was updated but admin audit status update failed:", processedAuditError);
        }
      } catch (ledgerError) {
        console.error("Provider processed refund could not be recorded in the product ledger:", ledgerError);
        finalStatus = "review_required";
        const { error: reviewUpdateError } = await adminClient
          .from("admin_refund_actions")
          .update({
            status: "review_required",
            provider_error: "Razorpay processed the refund, but EduAxis could not reconcile the purchase ledger.",
            updated_at: new Date().toISOString(),
          })
          .eq("id", action.id);
        if (reviewUpdateError) {
          console.error("Could not mark the admin refund action for manual review:", reviewUpdateError);
        }
      }
    }

    if (auditNeedsReview && finalStatus !== "review_required") {
      finalStatus = "review_required";
      const { error: reviewUpdateError } = await adminClient
        .from("admin_refund_actions")
        .update({
          status: "review_required",
          provider_error: "Razorpay accepted the refund, but EduAxis could not update its admin audit record. Verify provider and purchase ledgers before any retry.",
          updated_at: new Date().toISOString(),
        })
        .eq("id", action.id);
      if (reviewUpdateError) {
        console.error("Could not mark the admin refund action for manual review:", reviewUpdateError);
      }
    }

    const notificationStatus = finalStatus === "processed" ? "processed" : finalStatus === "pending" ? "pending" : "failed";
    const notification = finalStatus === "review_required"
      ? { inApp: "not_sent", email: "not_attempted" }
      : await notifyStudentOfRefund(adminClient, {
          studentId: order.studentId,
          studentEmail: order.studentEmail,
          refundId: providerRefund.id,
          status: notificationStatus,
          amountPaise: refundAmountPaise,
          productTitle: order.title,
          categoryLabel: category === "qa_study_material" ? "QA Test PDF" : category === "mock_test" ? "Mock Test" : category === "course" ? "Course" : "Study Material",
          orderReference: order.id,
        });

    return NextResponse.json({
      success: finalStatus === "pending" || finalStatus === "processed",
      actionId: action.id,
      refundId: providerRefund.id,
      status: finalStatus,
      refundType,
      amountPaise: refundAmountPaise,
      totalRefundedPaise,
      remainingPaise: Math.max(0, providerPayment.amount - totalRefundedPaise),
      notification,
      emailConfigured: Boolean(process.env.RESEND_API_KEY && process.env.RESEND_FROM_EMAIL),
      message: finalStatus === "processed"
        ? "Refund processed and recorded."
        : finalStatus === "pending"
          ? "Razorpay accepted the refund. EduAxis will update the purchase ledger after confirmation."
          : "Razorpay accepted the request but EduAxis needs to reconcile the result. Check the action history before retrying.",
    }, { status: finalStatus === "review_required" ? 202 : 200 });
  } catch (error) {
    console.error("Admin refunds POST error:", { actionId, error });
    return jsonError(error instanceof Error ? error.message : "Refund could not be initiated.", 500);
  }
}

function providerRefundRefundedTotal(previousRefunds: RazorpayRefund[], newRefund: RazorpayRefund) {
  return previousRefunds
    .filter((refund) => refund.status === "processed")
    .reduce((total, refund) => total + Number(refund.amount || 0), 0)
    + (newRefund.status === "processed" ? Number(newRefund.amount || 0) : 0);
}
