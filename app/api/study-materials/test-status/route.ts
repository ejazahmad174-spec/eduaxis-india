import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getStudyMaterialQaConfig } from "@/lib/study-material-qa";

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
      .select("study_material_id,status,amount_paise,refunded_paise")
      .eq("user_id", data.user.id)
      .in("status", ["paid", "partially_refunded"]);

    if (orderError) {
      console.error("QA study material status lookup failed:", orderError);
      return NextResponse.json({ error: "QA purchase status could not be loaded." }, { status: 500 });
    }

    const purchases = (orders || [])
      .filter((order) => Number(order.refunded_paise) < Number(order.amount_paise))
      .map((order) => order.study_material_id);

    return NextResponse.json({
      isQaAccount: true,
      enabled: config.enabled,
      webhookReady: config.webhookReady,
      purchases: Array.from(new Set(purchases)),
    });
  } catch (error) {
    console.error("QA payment status error:", error);
    return NextResponse.json({ error: "QA payment status is unavailable." }, { status: 500 });
  }
}
