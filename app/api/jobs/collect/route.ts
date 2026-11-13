
import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    success: true,
    message: "EduAxis India Government Jobs Collector API is ready.",
  });
}
