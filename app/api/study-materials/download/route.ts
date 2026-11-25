import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(request: Request) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !supabaseKey || !serviceKey) {
      return NextResponse.json({ error: "Study material service is not configured." }, { status: 500 });
    }

    const authorization = request.headers.get("authorization");
    const token = authorization?.startsWith("Bearer ") ? authorization.slice(7) : null;
    if (!token) return NextResponse.json({ error: "Please log in to download this PDF." }, { status: 401 });

    const authClient = createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: userData, error: authError } = await authClient.auth.getUser(token);
    if (authError || !userData.user) {
      return NextResponse.json({ error: "Your login session is invalid." }, { status: 401 });
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
      .select("id,title,file_path,access_type,status")
      .eq("id", materialId)
      .maybeSingle();

    if (materialError || !material || material.status !== "published" || material.access_type !== "paid") {
      return NextResponse.json({ error: "This paid PDF is not available." }, { status: 404 });
    }

    const { data: purchase, error: purchaseError } = await adminClient
      .from("study_material_purchases")
      .select("id,payment_order_id")
      .eq("user_id", userData.user.id)
      .eq("study_material_id", materialId)
      .maybeSingle();

    if (purchaseError) {
      console.error("Paid PDF entitlement lookup failed:", purchaseError);
      return NextResponse.json({ error: "Could not verify your PDF purchase." }, { status: 500 });
    }
    if (!purchase) {
      return NextResponse.json({ error: "Purchase required to download this PDF." }, { status: 403 });
    }

    const { data: payment, error: paymentError } = await adminClient
      .from("study_material_payment_orders")
      .select("status,razorpay_payment_id")
      .eq("id", purchase.payment_order_id)
      .eq("user_id", userData.user.id)
      .maybeSingle();

    if (paymentError || payment?.status !== "paid" || !payment.razorpay_payment_id) {
      return NextResponse.json({ error: "Your PDF access is not currently active. Please check your purchase status." }, { status: 403 });
    }

    if (typeof material.file_path !== "string" || !material.file_path.startsWith("premium-study-materials/")) {
      console.error("Paid PDF has an invalid private storage path.", material.id);
      return NextResponse.json({ error: "The PDF file is not configured correctly. Please contact support." }, { status: 500 });
    }

    const storagePath = material.file_path.slice("premium-study-materials/".length);
    if (!storagePath || storagePath.startsWith("/") || storagePath.split("/").some((part:string) => part === ".." || !part)) {
      return NextResponse.json({ error: "The PDF file path is invalid." }, { status: 500 });
    }

    const { data: signed, error: signedError } = await adminClient.storage
      .from("premium-study-materials")
      .createSignedUrl(storagePath, 300, { download: true });

    if (signedError || !signed?.signedUrl) {
      console.error("Paid PDF signed URL generation failed:", signedError);
      return NextResponse.json({ error: "Could not prepare the secure PDF download. Please retry." }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      signedUrl: signed.signedUrl,
      expiresIn: 300,
      title: material.title,
    });
  } catch (error) {
    console.error("Study material download error:", error);
    return NextResponse.json({ error: "Unable to prepare the PDF download." }, { status: 500 });
  }
}
