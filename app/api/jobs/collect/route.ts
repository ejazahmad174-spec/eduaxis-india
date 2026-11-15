
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { readJobPDF } from "@/lib/job-pdf-reader";

export const runtime = "nodejs";
export const maxDuration = 60;

type JobLink = {
  title: string;
  url: string;
};

type NoticeCategory =
  | "recruitment"
  | "teacher_eligibility"
  | "examination"
  | "certificate"
  | "general";

function cleanText(value: string): string {
  return value
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function isPdfUrl(value: string): boolean {
  try {
    return /\.pdf(?:$|[?#])/i.test(value);
  } catch {
    return false;
  }
}

function getTargetPages(sourceUrl: string): string[] {
  const hostname = new URL(sourceUrl).hostname.toLowerCase();

  if (hostname === "bpsc.bihar.gov.in") {
    return [
      "https://bpsc.bihar.gov.in/",
      "https://bpsc.bihar.gov.in/advertisement/",
    ];
  }

  if (hostname === "bssc.bihar.gov.in") {
    return ["https://bssc.bihar.gov.in/NoticeBoard.htm"];
  }

  return [sourceUrl];
}

function classifyNotice(
  title: string,
  url: string,
  sourceUrl: string
): NoticeCategory {
  const text = `${title} ${url}`.toLowerCase();
  const hostname = new URL(sourceUrl).hostname.toLowerCase();

  if (
    /certificate|marksheet|mark sheet|digilocker|credential|प्रमाणपत्र/i.test(
      text
    )
  ) {
    return "certificate";
  }

  if (
    /admit card|answer key|answer-key|result|exam date|examination schedule|exam schedule|exam city|hall ticket|प्रवेश पत्र|उत्तर कुंजी|परिणाम/i.test(
      text
    )
  ) {
    return "examination";
  }

  if (
    /ctet|teacher eligibility|eligibility test|eligibility certificate|application form|apply online|online application|registration|पात्रता परीक्षा/i.test(
      text
    )
  ) {
    return "teacher_eligibility";
  }

  if (
    /recruitment|vacancy|vacancies|advertisement|appointment|selection|career|job opening|भर्ती|नियुक्ति|रिक्ति/i.test(
      text
    )
  ) {
    return "recruitment";
  }

  if (hostname === "ctet.nic.in") {
    return "teacher_eligibility";
  }

  return "general";
}

function findRecruitmentLinks(
  html: string,
  pageUrl: string
): JobLink[] {
  const results: JobLink[] = [];
  const seen = new Set<string>();
  const baseUrl = new URL(pageUrl);

  const keywords =
    /recruitment|notification|advertisement|vacanc|career|apply online|application|employment|job opening|job notice|public notice|latest notice|examination notice|selection|invitation of applications|admit card|answer key|result|certificate|eligibility|marksheet|भर्ती|नियुक्ति|विज्ञापन|रिक्ति|आवेदन|परीक्षा|परिणाम|प्रमाणपत्र/i;

  const excludeKeywords =
    /tender|quotation|procurement|purchase|supply of|auction/i;

  const anchors = html.matchAll(
    /<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi
  );

  for (const match of anchors) {
    const href = match[1].trim();
    const anchorTitle = cleanText(match[2]);

    const rowStart = html.lastIndexOf("<tr", match.index);
    const rowEnd = html.indexOf("</tr>", match.index);

    let rowText = "";

    if (rowStart !== -1 && rowEnd !== -1) {
      rowText = cleanText(html.slice(rowStart, rowEnd + 5));
    }

    const title =
      anchorTitle.length >= 5 ? anchorTitle : rowText;

    const context = `${anchorTitle} ${rowText}`;

    if (
      !href ||
      title.length < 5 ||
      title.length > 600 ||
      (!keywords.test(context) && !isPdfUrl(href)) ||
      excludeKeywords.test(context)
    ) {
      continue;
    }

    try {
      const url = new URL(href, baseUrl);

      if (
        !["http:", "https:"].includes(url.protocol) ||
        !(
          url.hostname === baseUrl.hostname ||
          url.hostname.endsWith("." + baseUrl.hostname)
        )
      ) {
        continue;
      }

      url.hash = "";

      if (url.href === pageUrl || seen.has(url.href)) {
        continue;
      }

      seen.add(url.href);

      results.push({
        title: title.slice(0, 600),
        url: url.href,
      });

      if (results.length >= 50) {
        break;
      }
    } catch {
      continue;
    }
  }

  return results;
}

async function fetchPage(url: string): Promise<string> {
  const response = await fetch(url, {
    method: "GET",
    headers: {
      "User-Agent": "EduAxisIndiaJobCollector/3.0",
      Accept: "text/html,application/xhtml+xml",
    },
    signal: AbortSignal.timeout(15000),
    redirect: "follow",
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Website returned HTTP ${response.status}`);
  }

  const contentType = response.headers.get("content-type") || "";

  if (!contentType.includes("text/html")) {
    throw new Error("Source did not return an HTML webpage.");
  }

  return (await response.text()).slice(0, 2_000_000);
}

function findField(
  text: string,
  patterns: RegExp[]
): string | null {
  for (const pattern of patterns) {
    const match = text.match(pattern);

    if (match?.[1]) {
      return match[1].replace(/\s+/g, " ").trim().slice(0, 500);
    }
  }

  return null;
}

function extractJobDetails(text: string, pdfUrl: string) {
  const lines = text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter((line) => line.length > 2);

  const titleCandidates = lines
    .filter((line) =>
      /recruitment|advertisement|vacancy|notification|भर्ती|विज्ञापन/i.test(
        line
      )
    )
    .slice(0, 5);

  const vacancies = findField(text, [
    /(?:total\s+)?(?:number\s+of\s+)?vacancies\s*[:\-]?\s*([0-9,]+)/i,
    /total\s+posts\s*[:\-]?\s*([0-9,]+)/i,
    /number\s+of\s+posts\s*[:\-]?\s*([0-9,]+)/i,
    /कुल\s+पदों?\s*(?:की\s+संख्या)?\s*[:\-]?\s*([0-9,]+)/i,
  ]);

  const qualification = findField(text, [
    /educational\s+qualification\s*[:\-]?\s*([\s\S]{5,300}?)(?:\n|age\s+limit|application\s+fee)/i,
    /essential\s+qualification\s*[:\-]?\s*([\s\S]{5,300}?)(?:\n|age\s+limit|application\s+fee)/i,
    /शैक्षणिक\s+योग्यता\s*[:\-]?\s*([\s\S]{5,300}?)(?:\n|आयु|शुल्क)/i,
  ]);

  const ageLimit = findField(text, [
    /age\s+limit\s*[:\-]?\s*([\s\S]{3,200}?)(?:\n|application\s+fee|qualification)/i,
    /age\s+criteria\s*[:\-]?\s*([\s\S]{3,200}?)(?:\n|application\s+fee)/i,
    /आयु\s+सीमा\s*[:\-]?\s*([\s\S]{3,200}?)(?:\n|शुल्क)/i,
  ]);

  const applicationFee = findField(text, [
    /application\s+fee\s*[:\-]?\s*([\s\S]{2,150}?)(?:\n|important\s+dates|last\s+date)/i,
    /examination\s+fee\s*[:\-]?\s*([\s\S]{2,150}?)(?:\n|important\s+dates)/i,
    /आवेदन\s+शुल्क\s*[:\-]?\s*([\s\S]{2,150}?)(?:\n|महत्वपूर्ण\s+तिथियां)/i,
  ]);

  const applicationStartDate = findField(text, [
    /(?:online\s+)?application\s+(?:starts?|start\s+date|begin(?:s|ning)?|from)\s*[:\-]?\s*([0-9]{1,2}[\/.-][0-9]{1,2}[\/.-][0-9]{2,4}|[0-9]{1,2}\s+[A-Za-z]+\s+[0-9]{4})/i,
    /आवेदन\s+प्रारंभ\s+तिथि\s*[:\-]?\s*([0-9]{1,2}[\/.-][0-9]{1,2}[\/.-][0-9]{2,4})/i,
  ]);

  const lastDate = findField(text, [
    /(?:last\s+date|closing\s+date|last\s+date\s+for\s+application)\s*[:\-]?\s*([0-9]{1,2}[\/.-][0-9]{1,2}[\/.-][0-9]{2,4}|[0-9]{1,2}\s+[A-Za-z]+\s+[0-9]{4})/i,
    /अंतिम\s+तिथि\s*[:\-]?\s*([0-9]{1,2}[\/.-][0-9]{1,2}[\/.-][0-9]{2,4})/i,
  ]);

  const examDate = findField(text, [
    /(?:date\s+of\s+)?(?:written\s+)?examination\s*[:\-]?\s*([0-9]{1,2}[\/.-][0-9]{1,2}[\/.-][0-9]{2,4}|[0-9]{1,2}\s+[A-Za-z]+\s+[0-9]{4})/i,
    /परीक्षा\s+तिथि\s*[:\-]?\s*([0-9]{1,2}[\/.-][0-9]{1,2}[\/.-][0-9]{2,4})/i,
  ]);

  return {
    job_title_candidates: titleCandidates,
    department: null,
    vacancies,
    qualification,
    age_limit: ageLimit,
    application_fee: applicationFee,
    application_start_date: applicationStartDate,
    last_date: lastDate,
    examination_date: examDate,
    apply_url: null,
    source_pdf_url: pdfUrl,
    extraction_note:
      "Automatically extracted text. All fields require admin verification.",
    extracted_text_excerpt: text.slice(0, 12000),
    extracted_text_length: text.length,
  };
}

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!cronSecret || !supabaseUrl || !serviceKey) {
    return NextResponse.json(
      { error: "Collector configuration is incomplete." },
      { status: 500 }
    );
  }

  if (request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json(
      { error: "Unauthorized." },
      { status: 401 }
    );
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  const { data: sources, error: sourceError } = await supabase
    .from("government_job_sources")
    .select("id, source_name, source_url")
    .eq("is_active", true);

  if (sourceError) {
    console.error("Could not load job sources:", sourceError);

    return NextResponse.json(
      { error: "Could not load recruitment sources." },
      { status: 500 }
    );
  }

  let checked = 0;
  let discovered = 0;
  let pdfsProcessed = 0;
  let pdfsSuccessful = 0;

  const MAX_PDFS_PER_RUN = 2;

  const results: {
    source: string;
    pages_checked: number;
    found: number;
    pdfs_read: number;
    error?: string;
  }[] = [];

  for (const source of sources || []) {
    checked++;

    try {
      const targetPages = getTargetPages(source.source_url);
      const allLinks = new Map<string, JobLink>();

      let pagesChecked = 0;

      for (const pageUrl of targetPages) {
        try {
          const html = await fetchPage(pageUrl);
          pagesChecked++;

          const links = findRecruitmentLinks(html, pageUrl);

          for (const link of links) {
            if (!allLinks.has(link.url)) {
              allLinks.set(link.url, link);
            }
          }
        } catch (pageError) {
          console.error("Page scan failed:", pageUrl, pageError);
        }
      }

      if (pagesChecked === 0) {
        throw new Error("All configured pages failed to load.");
      }

      const links = Array.from(allLinks.values());

      if (links.length > 0) {
        const rows = links.map((link) => ({
          source_id: source.id,
          discovered_title: link.title,
          discovered_url: link.url,
          pdf_url: isPdfUrl(link.url) ? link.url : null,
          notice_category: classifyNotice(
            link.title,
            link.url,
            source.source_url
          ),
          status: "new",
        }));

        const { error: insertError } = await supabase
          .from("government_job_discoveries")
          .upsert(rows, {
            onConflict: "source_id,discovered_url",
            ignoreDuplicates: true,
          });

        if (insertError) {
          throw new Error(insertError.message);
        }

        discovered += links.length;
      }

      let sourcePdfsRead = 0;

      const pdfLinks = links.filter((link) => isPdfUrl(link.url));

      for (const link of pdfLinks) {
        if (pdfsProcessed >= MAX_PDFS_PER_RUN) {
          break;
        }

        pdfsProcessed++;

        const { data: discovery, error: discoveryError } = await supabase
          .from("government_job_discoveries")
          .select("id, extraction_status")
          .eq("source_id", source.id)
          .eq("discovered_url", link.url)
          .maybeSingle();

        if (discoveryError || !discovery) {
          console.error("Could not load PDF discovery:", discoveryError);
          continue;
        }

        if (
          discovery.extraction_status === "completed" ||
          discovery.extraction_status === "processing"
        ) {
          continue;
        }

        await supabase
          .from("government_job_discoveries")
          .update({
            pdf_url: link.url,
            extraction_status: "processing",
            extraction_error: null,
          })
          .eq("id", discovery.id);

        const pdfResult = await readJobPDF(link.url);

        if (!pdfResult.success) {
          const needsOcr =
            pdfResult.error?.toLowerCase().includes("very little text") ||
            false;

          await supabase
            .from("government_job_discoveries")
            .update({
              extraction_status: needsOcr ? "needs_ocr" : "failed",
              extraction_error: pdfResult.error || "PDF reading failed.",
              extracted_at: new Date().toISOString(),
            })
            .eq("id", discovery.id);

          continue;
        }

        const extractedDetails = extractJobDetails(
          pdfResult.text,
          link.url
        );

        const { error: updateError } = await supabase
          .from("government_job_discoveries")
          .update({
            pdf_url: link.url,
            extracted_details: {
              ...extractedDetails,
              pdf_pages: pdfResult.pages,
            },
            extraction_status: "completed",
            extraction_error: null,
            extracted_at: new Date().toISOString(),
          })
          .eq("id", discovery.id);

        if (updateError) {
          console.error("Could not save extracted PDF details:", updateError);
        } else {
          pdfsSuccessful++;
          sourcePdfsRead++;
        }
      }

      const now = new Date().toISOString();

      await supabase
        .from("government_job_sources")
        .update({
          last_checked_at: now,
          last_success_at: now,
          last_error: null,
          updated_at: now,
        })
        .eq("id", source.id);

      results.push({
        source: source.source_name,
        pages_checked: pagesChecked,
        found: links.length,
        pdfs_read: sourcePdfsRead,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown error";

      console.error(
        "Job source collection failed:",
        source.source_name,
        message
      );

      await supabase
        .from("government_job_sources")
        .update({
          last_checked_at: new Date().toISOString(),
          last_error: message.slice(0, 1000),
          updated_at: new Date().toISOString(),
        })
        .eq("id", source.id);

      results.push({
        source: source.source_name,
        pages_checked: 0,
        found: 0,
        pdfs_read: 0,
        error: message,
      });
    }
  }

  return NextResponse.json({
    success: true,
    message: "Government job discovery and PDF extraction completed.",
    sources_checked: checked,
    candidate_links_found: discovered,
    pdfs_processed: pdfsProcessed,
    pdfs_successfully_read: pdfsSuccessful,
    results,
  });
}
