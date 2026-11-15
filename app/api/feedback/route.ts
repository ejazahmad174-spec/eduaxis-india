
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey =
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json(
        { error: "Feedback service is not configured." },
        { status: 500 }
      );
    }

    const body = await request.json();

    const name =
      typeof body.name === "string" ? body.name.trim() : "";
    const email =
      typeof body.email === "string" ? body.email.trim() : "";
    const subject =
      typeof body.subject === "string" ? body.subject.trim() : "";
    const message =
      typeof body.message === "string" ? body.message.trim() : "";

    if (
      name.length < 2 || name.length > 100 ||
      email.length < 5 || email.length > 254 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
      subject.length < 2 || subject.length > 100 ||
      message.length < 5 || message.length > 5000
    ) {
      return NextResponse.json(
        { error: "Please check your details and try again." },
        { status: 400 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    const { error } = await supabase
      .from("website_feedback")
      .insert({
        name,
        email,
        subject,
        message,
        status: "new",
      });

    if (error) {
      console.error("Feedback submission failed:", error);

      return NextResponse.json(
        { error: "Your feedback could not be saved. Please try again." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Thank you! Your feedback has been submitted successfully.",
    });
  } catch (error) {
    console.error("Feedback API error:", error);

    return NextResponse.json(
      { error: "An unexpected error occurred. Please try again." },
      { status: 500 }
    );
  }
}
