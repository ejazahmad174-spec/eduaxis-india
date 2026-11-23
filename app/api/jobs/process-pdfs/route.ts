
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { readJobPDF } from "@/lib/job-pdf-reader";

export const runtime = "nodejs";
export const maxDuration = 60;

function extractJobDetails(text: string, pdfUrl: string) {
  const normalizedText = text
    .replace(/\r/g, "\n")
    .replace(/\u0000/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  const compactText = normalizedText.replace(/\s+/g, " ");

  function clean(
    value: string | null | undefined,
    max = 1000
  ): string | null {
    if (!value) return null;
    const result = value
      .replace(/\s+/g, " ")
      .trim()
      .replace(/[.;,:\s]+$/, "");
    return result ? result.slice(0, max) : null;
  }

  function firstMatch(patterns: RegExp[]): string | null {
    for (const pattern of patterns) {
      const match = compactText.match(pattern);
      if (match?.[1]) return clean(match[1]);
    }
    return null;
  }

  function getSection(
    start: RegExp,
    end: RegExp,
    max = 1500
  ): string | null {
    const match = start.exec(compactText);
    if (!match || match.index === undefined) return null;

    const afterStart = compactText.slice(
      match.index + match[0].length
    );

    const endMatch = end.exec(afterStart);

    return clean(
      afterStart.slice(0, endMatch ? endMatch.index : max),
      max
    );
  }

  const vacancyMatch = compactText.match(
    /\b(\d[\d,]*)\s+vacancies?\s+for\s+the\s+post\s+of\s+(.{5,180}?)(?=\s+in\s+|\s+under\s+|\.|$)/i
  );

  const vacancies = firstMatch([
    /(?:total\s+)?(?:number\s+of\s+)?vacancies\s*[:\-]?\s*([\d,]+)/i,
    /([\d,]+)\s+(?:vacancies|vacant\s+posts|posts)/i,
    /(?:total\s+of)\s+([\d,]+)\s+(?:posts|vacancies)/i,
  ]);

  const jobTitle = clean(vacancyMatch?.[2], 200);

  const titleCandidates = [
    ...(jobTitle ? [jobTitle] : []),
    ...normalizedText
      .split(/\n+/)
      .map((line) => line.trim())
      .filter((line) =>
        /special advertisement|assistant|officer|teacher|translator|recruitment|vacancy details/i.test(line)
      ),
  ]
    .filter((item, index, array) => array.indexOf(item) === index)
    .slice(0, 8);

  const payScale = getSection(
    /\bPAY\s+SCALE\s*:/i,
    /\bAGE\s*:/i,
    500
  );

  const ageLimit = getSection(
    /\bAGE\s*:/i,
    /\bESSENTIAL\s+QUALIFICATIONS?\s*:/i,
    800
  );

  const essentialBlock = getSection(
    /\bESSENTIAL\s+QUALIFICATIONS?\s*:/i,
    /\bDUTIES\s*:/i,
    1200
  );

  const qualification = clean(
    essentialBlock
      ?.replace(/^EDUCATIONAL\s*/i, "")
      .replace(/\s+DESIRABLE\s+QUALIFICATIONS?[\s\S]*$/i, ""),
    800
  );

  const desirableQualification = firstMatch([
    /DESIRABLE\s+QUALIFICATIONS?\s*:\s*(.{5,500}?)(?=\s+NOTE\s+\d|\s+DUTIES\s*:|$)/i,
  ]);

  const applicationFee =
    getSection(
      /\bAPPLICATION\s+FEE\s*:/i,
      /\bCONCESSIONS\s*(?:AND|&)\s*RELAXATIONS\b/i,
      700
    ) ||
    firstMatch([
      /(?:application|examination|registration)\s+fee\s*[:\-]?\s*(.{3,350}?)(?=important\s+dates|last\s+date|how\s+to\s+apply|$)/i,
    ]);

  const applicationStartDate = firstMatch([
    /ONLINE\s+RECRUITMENT\s+APPLICATIONS\s+ARE\s+INVITED[\s\S]{0,300}?\bFROM\s+(\d{1,2}[.-]\d{1,2}[.-]\d{4})/i,
    /APPLICATIONS?\s+(?:START|BEGIN|OPEN)[\s\S]{0,100}?(\d{1,2}[\/.-]\d{1,2}[\/.-]\d{2,4})/i,
  ]);

  const lastDate = firstMatch([
    /CLOSING\s+DATE\s+FOR\s+SUBMISSION[\s\S]{0,300}?\bON\s+(\d{1,2}[\/.-]\d{1,2}[\/.-]\d{2,4})/i,
    /LAST\s+DATE(?:\s+FOR\s+SUBMISSION|\s+TO\s+APPLY)?\s*[:\-]?\s*(\d{1,2}[\/.-]\d{1,2}[\/.-]\d{2,4})/i,
  ]);

  const examinationDate = firstMatch([
    /RECRUITMENT\s+TEST[\s\S]{0,400}?\bON\s+(\d{1,2}[\/.-]\d{1,2}[\/.-]\d{2,4})/i,
    /(?:DATE\s+OF\s+)?(?:WRITTEN\s+)?EXAMINATION\s*[:\-]?\s*(\d{1,2}[\/.-]\d{1,2}[\/.-]\d{2,4})/i,
    /EXAM(?:INATION)?\s+DATE\s*[:\-]?\s*(\d{1,2}[\/.-]\d{1,2}[\/.-]\d{2,4})/i,
  ]);

  const department = firstMatch([
    /(?:name\s+of\s+the\s+)?department\s*[:\-]?\s*([^.;]{3,200})/i,
    /organisation\s*[:\-]?\s*([^.;]{3,200})/i,
  ]);

  const categoryWiseVacancies = firstMatch([
    /RESERVATION\s+POSITION\s*:\s*\(([^)]{5,200})\)/i,
  ]);

  const applyUrl =
    compactText.match(/https?:\/\/upsconline\.nic\.in\/ora\/?/i)?.[0] ||
    null;

  return {
    job_title_candidates: titleCandidates,
    department,
    vacancies,
    category_wise_vacancies: categoryWiseVacancies,
    pay_scale: payScale,
    qualification,
    desirable_qualification: desirableQualification,
    age_limit: ageLimit,
    application_fee: applicationFee,
    application_start_date: applicationStartDate,
    last_date: lastDate,
    examination_date: examinationDate,
    apply_url: applyUrl,
    source_pdf_url: pdfUrl,
    extraction_note:
      "Automatically extracted text. All fields require admin verification against the official notification.",
    extracted_text_excerpt: normalizedText.slice(0, 12000),
    extracted_text_length: normalizedText.length,
  };
}

export async function GET(request: Request) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    const publishableKey =
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !serviceKey || !publishableKey) {
      return NextResponse.json(
        { error: "Supabase configuration is incomplete." },
        { status: 500 }
      );
    }

    const authorization =
      request.headers.get("authorization") || "";

    const accessToken = authorization.startsWith("Bearer ")
      ? authorization.slice(7).trim()
      : "";

    if (!accessToken) {
      return NextResponse.json(
        { error: "Administrator login is required." },
        { status: 401 }
      );
    }

    const authClient = createClient(
      supabaseUrl,
      publishableKey,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      }
    );

    const { data: userData, error: authError } =
      await authClient.auth.getUser(accessToken);

    if (authError || !userData.user) {
      return NextResponse.json(
        { error: "Your session is invalid or expired." },
        { status: 401 }
      );
    }

    const supabase = createClient(
      supabaseUrl,
      serviceKey,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      }
    );

    const { data: profile, error: profileError } =
      await supabase
        .from("profiles")
        .select("role")
        .eq("id", userData.user.id)
        .maybeSingle();

    if (profileError || profile?.role !== "admin") {
      return NextResponse.json(
        { error: "Administrator access is required." },
        { status: 403 }
      );
    }

    // A Vercel function is limited to 60 seconds. Five minutes is a
    // conservative lease timeout for recovering interrupted processing jobs.
    const staleBefore = new Date(Date.now() - 5 * 60 * 1000).toISOString();

    // Recover old records with a timestamp, using a conditional UPDATE so
    // a row that has already changed state is not reset.
    const { error: staleRecoveryError } = await supabase
      .from("government_job_discoveries")
      .update({
        extraction_status: "pending",
        processing_started_at: null,
        extraction_error: "Recovered after an interrupted PDF processing attempt.",
      })
      .eq("extraction_status", "processing")
      .lt("processing_started_at", staleBefore);

    if (staleRecoveryError) {
      throw new Error(staleRecoveryError.message);
    }

    // Also recover legacy processing rows created before the timestamp
    // column was introduced.
    const { error: legacyRecoveryError } = await supabase
      .from("government_job_discoveries")
      .update({
        extraction_status: "pending",
        processing_started_at: null,
        extraction_error: "Recovered legacy processing record without a start timestamp.",
      })
      .eq("extraction_status", "processing")
      .is("processing_started_at", null);

    if (legacyRecoveryError) {
      throw new Error(legacyRecoveryError.message);
    }

    const { data: pending, error: pendingError } =
      await supabase
        .from("government_job_discoveries")
        .select("id, pdf_url, discovered_url")
        .eq("extraction_status", "pending")
        .not("pdf_url", "is", null)
        .order("discovered_at", { ascending: true })
        .limit(1);

    if (pendingError) {
      throw new Error(pendingError.message);
    }

    const discovery = pending?.[0];

    if (!discovery) {
      return NextResponse.json({
        success: true,
        message: "No pending PDF notices are available.",
        processed: false,
      });
    }

    const pdfUrl =
      discovery.pdf_url || discovery.discovered_url;

    if (!/\.pdf(?:$|[?#])/i.test(pdfUrl)) {
      return NextResponse.json(
        { error: "The pending notice does not have a valid PDF URL." },
        { status: 400 }
      );
    }

    const { data: claimed, error: claimError } =
      await supabase
        .from("government_job_discoveries")
        .update({
          extraction_status: "processing",
          processing_started_at: new Date().toISOString(),
          extraction_error: null,
        })
        .eq("id", discovery.id)
        .eq("extraction_status", "pending")
        .select("id")
        .maybeSingle();

    if (claimError) {
      throw new Error(claimError.message);
    }

    if (!claimed) {
      return NextResponse.json({
        success: true,
        message: "This PDF is already being processed.",
        processed: false,
      });
    }

    const pdfResult = await readJobPDF(pdfUrl);

    if (!pdfResult.success) {
      const needsOcr =
        pdfResult.error?.toLowerCase().includes("very little text") ||
        pdfResult.error?.toLowerCase().includes("ocr");

      const { error: failureError } = await supabase
        .from("government_job_discoveries")
        .update({
          pdf_url: pdfUrl,
          extraction_status: needsOcr ? "needs_ocr" : "failed",
          processing_started_at: null,
          extraction_error:
            pdfResult.error || "PDF reading failed.",
          extracted_at: new Date().toISOString(),
        })
        .eq("id", discovery.id)
        .eq("extraction_status", "processing");

      if (failureError) {
        throw new Error(failureError.message);
      }

      return NextResponse.json({
        success: false,
        processed: true,
        message: "PDF extraction failed.",
        error: pdfResult.error,
      });
    }

    const extractedDetails = extractJobDetails(
      pdfResult.text,
      pdfUrl
    );

    const { error: updateError } = await supabase
      .from("government_job_discoveries")
      .update({
        pdf_url: pdfUrl,
        extracted_details: {
          ...extractedDetails,
          pdf_pages: pdfResult.pages,
        },
        extraction_status: "completed",
        processing_started_at: null,
        extraction_error: null,
        extracted_at: new Date().toISOString(),
      })
      .eq("id", discovery.id)
      .eq("extraction_status", "processing");

    if (updateError) {
      throw new Error(updateError.message);
    }

    return NextResponse.json({
      success: true,
      processed: true,
      message: "One PDF was successfully processed.",
      discovery_id: discovery.id,
      pdf_pages: pdfResult.pages,
      extracted_text_length: pdfResult.text.length,
    });
  } catch (error) {
    console.error("PDF processing error:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unexpected PDF processing error.",
      },
      { status: 500 }
    );
  }
}

