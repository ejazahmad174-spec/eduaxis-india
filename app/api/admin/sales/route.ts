import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

type PaymentOrder = {
  id: string;
  student_id: string;
  mock_test_id?: string;
  course_id?: string;
  user_id?: string;
  amount_paise: number;
  status: string;
  razorpay_payment_id: string | null;
  created_at: string;
  paid_at: string | null;
};

type Refund = {
  payment_order_id: string;
  amount_paise: number;
  status: string;
  created_at: string;
};

type ProductSales = {
  id: string;
  title: string;
  orders: number;
  buyers: number;
  gross_paise: number;
  refunds_paise: number;
  net_paise: number;
  active_orders: number;
  fully_refunded_orders: number;
};

type Transaction = {
  id: string;
  category: "Mock Test" | "Course";
  title: string;
  kind: "Payment" | "Refund";
  status: string;
  amount_paise: number;
  date: string;
};

function sum(values: number[]) {
  return values.reduce((total, value) => total + (Number(value) || 0), 0);
}

function groupSales(
  orders: PaymentOrder[],
  refunds: Refund[],
  products: Array<{ id: string; title: string }>,
  category: "Mock Test" | "Course",
) {
  const titles = new Map(products.map((product) => [product.id, product.title]));
  const refundsByOrder = new Map<string, number>();

  for (const refund of refunds) {
    if (refund.status !== "processed") continue;
    refundsByOrder.set(
      refund.payment_order_id,
      (refundsByOrder.get(refund.payment_order_id) || 0) + Number(refund.amount_paise || 0),
    );
  }

  const groups = new Map<string, {
    id: string;
    title: string;
    orders: number;
    students: Set<string>;
    gross_paise: number;
    refunds_paise: number;
    active_orders: number;
    fully_refunded_orders: number;
  }>();

  for (const order of orders) {
    const productId = category === "Mock Test" ? order.mock_test_id : order.course_id;
    if (!productId) continue;

    const group = groups.get(productId) || {
      id: productId,
      title: titles.get(productId) || "Deleted or unavailable product",
      orders: 0,
      students: new Set<string>(),
      gross_paise: 0,
      refunds_paise: 0,
      active_orders: 0,
      fully_refunded_orders: 0,
    };

    group.orders += 1;
    group.students.add(order.student_id || order.user_id || "unknown");
    group.gross_paise += Number(order.amount_paise || 0);
    group.refunds_paise += refundsByOrder.get(order.id) || 0;
    if (order.status === "paid") group.active_orders += 1;
    if (order.status === "refunded") group.fully_refunded_orders += 1;
    groups.set(productId, group);
  }

  return Array.from(groups.values())
    .map((group): ProductSales => ({
      id: group.id,
      title: group.title,
      orders: group.orders,
      buyers: group.students.size,
      gross_paise: group.gross_paise,
      refunds_paise: group.refunds_paise,
      net_paise: group.gross_paise - group.refunds_paise,
      active_orders: group.active_orders,
      fully_refunded_orders: group.fully_refunded_orders,
    }))
    .sort((a, b) => b.gross_paise - a.gross_paise);
}

export async function GET(request: Request) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey || !serviceKey) {
      return NextResponse.json(
        { error: "The sales reporting service is not configured." },
        { status: 500 },
      );
    }

    const authorization = request.headers.get("authorization");
    const token = authorization?.startsWith("Bearer ")
      ? authorization.slice(7)
      : null;

    if (!token) {
      return NextResponse.json({ error: "Administrator sign-in is required." }, { status: 401 });
    }

    const authClient = createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: authData, error: authError } = await authClient.auth.getUser(token);

    if (authError || !authData.user) {
      return NextResponse.json({ error: "Your administrator session is invalid." }, { status: 401 });
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
      return NextResponse.json({ error: "You are not authorised to view sales reports." }, { status: 403 });
    }

    const [
      mockOrdersResult,
      mockRefundsResult,
      mockTestsResult,
      courseOrdersResult,
      courseRefundsResult,
      coursesResult,
      materialsResult,
    ] = await Promise.all([
      adminClient
        .from("payment_orders")
        .select("id,student_id,mock_test_id,amount_paise,status,razorpay_payment_id,created_at,paid_at")
        .in("status", ["paid", "refunded"])
        .not("razorpay_payment_id", "is", null)
        .order("paid_at", { ascending: false }),
      adminClient
        .from("payment_refunds")
        .select("payment_order_id,amount_paise,status,created_at")
        .eq("status", "processed"),
      adminClient
        .from("mock_tests")
        .select("id,title,exam_category,status,access_type,price"),
      adminClient
        .from("course_payment_orders")
        .select("id,user_id,course_id,amount_paise,status,razorpay_payment_id,created_at,paid_at")
        .in("status", ["paid", "refunded"])
        .not("razorpay_payment_id", "is", null)
        .order("paid_at", { ascending: false }),
      adminClient
        .from("course_payment_refunds")
        .select("payment_order_id,amount_paise,status,created_at")
        .eq("status", "processed"),
      adminClient
        .from("courses")
        .select("id,title"),
      adminClient
        .from("study_materials")
        .select("id,title,status,access_type,price"),
    ]);

    const errors = [
      mockOrdersResult.error,
      mockRefundsResult.error,
      mockTestsResult.error,
      courseOrdersResult.error,
      courseRefundsResult.error,
      coursesResult.error,
      materialsResult.error,
    ].filter(Boolean);

    if (errors.length > 0) {
      console.error("Sales report query failed:", errors);
      return NextResponse.json(
        { error: "Some sales records could not be loaded. Please retry or contact support." },
        { status: 500 },
      );
    }

    const mockOrders = (mockOrdersResult.data || []) as PaymentOrder[];
    const mockRefunds = (mockRefundsResult.data || []) as Refund[];
    const courseOrders = (courseOrdersResult.data || []) as PaymentOrder[];
    const courseRefunds = (courseRefundsResult.data || []) as Refund[];

    const mockSales = groupSales(
      mockOrders,
      mockRefunds,
      (mockTestsResult.data || []).map((item) => ({ id: item.id, title: item.title })),
      "Mock Test",
    );
    const courseSales = groupSales(
      courseOrders,
      courseRefunds,
      (coursesResult.data || []).map((item) => ({ id: item.id, title: item.title })),
      "Course",
    );

    const mockGross = sum(mockOrders.map((order) => Number(order.amount_paise)));
    const courseGross = sum(courseOrders.map((order) => Number(order.amount_paise)));
    const mockRefundTotal = sum(mockRefunds.map((refund) => Number(refund.amount_paise)));
    const courseRefundTotal = sum(courseRefunds.map((refund) => Number(refund.amount_paise)));

    const buyerIds = new Set([
      ...mockOrders.map((order) => order.student_id),
      ...courseOrders.map((order) => order.user_id),
    ].filter(Boolean));

    const recentTransactions: Transaction[] = [
      ...mockOrders.map((order) => ({
        id: order.id,
        category: "Mock Test" as const,
        title: mockSales.find((item) => item.id === order.mock_test_id)?.title || "Mock Test",
        kind: "Payment" as const,
        status: order.status,
        amount_paise: Number(order.amount_paise),
        date: order.paid_at || order.created_at,
      })),
      ...courseOrders.map((order) => ({
        id: order.id,
        category: "Course" as const,
        title: courseSales.find((item) => item.id === order.course_id)?.title || "Course",
        kind: "Payment" as const,
        status: order.status,
        amount_paise: Number(order.amount_paise),
        date: order.paid_at || order.created_at,
      })),
      ...mockRefunds.map((refund) => {
        const order = mockOrders.find((item) => item.id === refund.payment_order_id);
        return {
          id: "mock-refund-" + refund.payment_order_id + "-" + refund.created_at,
          category: "Mock Test" as const,
          title: mockSales.find((item) => item.id === order?.mock_test_id)?.title || "Mock Test refund",
          kind: "Refund" as const,
          status: refund.status,
          amount_paise: Number(refund.amount_paise),
          date: refund.created_at,
        };
      }),
      ...courseRefunds.map((refund) => {
        const order = courseOrders.find((item) => item.id === refund.payment_order_id);
        return {
          id: "course-refund-" + refund.payment_order_id + "-" + refund.created_at,
          category: "Course" as const,
          title: courseSales.find((item) => item.id === order?.course_id)?.title || "Course refund",
          kind: "Refund" as const,
          status: refund.status,
          amount_paise: Number(refund.amount_paise),
          date: refund.created_at,
        };
      }),
    ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 30);

    const materials = materialsResult.data || [];
    const publishedMaterials = materials.filter((material) => material.status === "published");
    const paidMaterials = publishedMaterials.filter((material) => material.access_type === "paid");
    const freeMaterials = publishedMaterials.filter((material) => material.access_type === "free");

    return NextResponse.json({
      generatedAt: new Date().toISOString(),
      summary: {
        gross_paise: mockGross + courseGross,
        refunds_paise: mockRefundTotal + courseRefundTotal,
        net_paise: mockGross + courseGross - mockRefundTotal - courseRefundTotal,
        successful_orders: mockOrders.length + courseOrders.length,
        unique_buyers: buyerIds.size,
        mock_test_orders: mockOrders.length,
        course_orders: courseOrders.length,
      },
      mockTests: {
        orders: mockOrders.length,
        buyers: new Set(mockOrders.map((order) => order.student_id)).size,
        gross_paise: mockGross,
        refunds_paise: mockRefundTotal,
        net_paise: mockGross - mockRefundTotal,
        products: mockSales,
      },
      courses: {
        orders: courseOrders.length,
        buyers: new Set(courseOrders.map((order) => order.user_id)).size,
        gross_paise: courseGross,
        refunds_paise: courseRefundTotal,
        net_paise: courseGross - courseRefundTotal,
        products: courseSales,
      },
      studyMaterials: {
        tracking_enabled: false,
        published_count: publishedMaterials.length,
        paid_published_count: paidMaterials.length,
        free_published_count: freeMaterials.length,
        note: "Study-material checkout and purchase records are not implemented yet. Sales and buyer counts are therefore unavailable for this category.",
      },
      recentTransactions,
    });
  } catch (error) {
    console.error("Admin sales report error:", error);
    return NextResponse.json(
      { error: "Unable to build the sales report right now." },
      { status: 500 },
    );
  }
}
