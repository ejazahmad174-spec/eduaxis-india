import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(request: Request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const cronSecret = process.env.CRON_SECRET;

  if (!supabaseUrl || !publishableKey || !serviceRoleKey || !cronSecret) {
    return jsonError("Current Affairs collection is not fully configured on the server.", 500);
  }

  const authorization = request.headers.get("authorization");
  const token = authorization?.startsWith("Bearer ") ? authorization.slice(7) : null;

  if (!token) {
    return jsonError("Administrator sign-in is required.", 401);
  }

  const authClient = createClient(supabaseUrl, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: authData, error: authError } = await authClient.auth.getUser(token);

  if (authError || !authData.user) {
    return jsonError("Your administrator session is invalid. Please sign in again.", 401);
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: profile, error: profileError } = await adminClient
    .from("profiles")
    .select("role")
    .eq("id", authData.user.id)
    .maybeSingle();

  if (profileError || profile?.role !== "admin") {
    return jsonError("You are not authorised to run Current Affairs collection.", 403);
  }

  let categories: string[] = ["national", "international", "education", "bihar"];
  try {
    const body = await request.json();
    if (
      !body ||
      !Array.isArray(body.categories) ||
      body.categories.length < 1 ||
      body.categories.some(
        (value: unknown) =>
          typeof value !== "string" ||
          !["national", "international", "education", "bihar"].includes(value)
      )
    ) {
      return jsonError("Select one or more valid Current Affairs categories.", 400);
    }
    categories = [...new Set(body.categories as string[])];
  } catch {
    return jsonError("A valid category selection is required.", 400);
  }

  try {
    const collectionUrl = new URL("/api/current-affairs/collect", request.url);
    const response = await fetch(collectionUrl, {
      method: "POST",
      headers: {
        Authorization: "Bearer " + cronSecret,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ categories }),
      cache: "no-store",
      signal: AbortSignal.timeout(55000),
    });

    const result = await response.json().catch(() => ({}));

    return NextResponse.json(result, { status: response.status });
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "Could not run Current Affairs collection.",
      502
    );
  }
}
