import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
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
      return NextResponse.json({ error: "QA download service is not configured." }, { status: 503 });
    }

    const authorization = request.headers.get("authorization");
    const token = authorization?.startsWith("Bearer ") ? authorization.slice(7) : null;
    if (!token) return NextResponse.json({ error: "Please sign in to download the QA PDF." }, { status: 401 });

    const authClient = createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: userData, error: authError } = await authClient.auth.getUser(token);
    if (authError || !userData.user) return NextResponse.json({ error: "Your student session is invalid." }, { status: 401 });
    if (!config.qaUserId || userData.user.id !== config.qaUserId) {
      return NextResponse.json({ error: "This download is restricted to the QA student account." }, { status: 403 });
    }
    if (!config.enabled) return NextResponse.json({ error: "QA test mode is not enabled." }, { status: 503 });

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
      .select("id,title,file_path,status,access_type")
      .eq("id", materialId)
      .maybeSingle();

    if (materialError || !material || material.status !== "published" || material.access_type !== "paid") {
      return NextResponse.json({ error: "This premium PDF is not available." }, { status: 404 });
    }

    const { data: payment, error: paymentError } = await adminClient
      .from("study_material_qa_payment_orders")
      .select("id,status,amount_paise,refunded_paise,razorpay_payment_id")
      .eq("user_id", userData.user.id)
      .eq("study_material_id", materialId)
      .in("status", ["paid", "partially_refunded"])
      .not("razorpay_payment_id", "is", null)
      .order("paid_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (paymentError) {
      console.error("QA purchase lookup failed:", paymentError);
      return NextResponse.json({ error: "Could not verify QA PDF access." }, { status: 500 });
    }
    if (!payment || Number(payment.refunded_paise) >= Number(payment.amount_paise)) {
      return NextResponse.json({ error: "No active QA PDF purchase exists." }, { status: 403 });
    }

    if (typeof material.file_path !== "string" || !material.file_path.startsWith("premium-study-materials/")) {
      return NextResponse.json({ error: "The PDF does not use private premium storage." }, { status: 500 });
    }

    const storagePath = material.file_path.slice("premium-study-materials/".length);
    if (!storagePath || storagePath.startsWith("/") || storagePath.split("/").some((part: string) => part === ".." || !part)) {
      return NextResponse.json({ error: "The PDF storage path is invalid." }, { status: 500 });
    }

    const { data: signed, error: signedError } = await adminClient.storage
      .from("premium-study-materials")
      .createSignedUrl(storagePath, 300, { download: true });
    if (signedError || !signed?.signedUrl) {
      console.error("QA PDF signed URL generation failed:", signedError);
      return NextResponse.json({ error: "Could not prepare the secure QA download." }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      testMode: true,
      signedUrl: signed.signedUrl,
      expiresIn: 300,
      title: material.title,
    });
  } catch (error) {
    console.error("Study material QA download error:", error);
    return NextResponse.json({ error: "Unable to prepare the QA PDF download." }, { status: 500 });
  }
}
