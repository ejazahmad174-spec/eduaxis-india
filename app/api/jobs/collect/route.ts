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
  const normalizedText = text
    .replace(/\r/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n");

  const lines = normalizedText
    .split(/\n+/)
    .map((line) => line.trim())
    .filter((line) => line.length > 2);

  const compactText = normalizedText.replace(/\s+/g, " ");

  function extract(patterns: RegExp[]): string | null {
    for (const pattern of patterns) {
      const match = compactText.match(pattern);

      if (match?.[1]) {
        return match[1]
          .replace(/\s+/g, " ")
          .replace(/[.;,:]+$/, "")
          .trim()
          .slice(0, 1000);
      }
    }

    return null;
  }

  const titleCandidates = lines
    .filter((line) =>
      /special advertisement|recruitment|invites online|vacancy details|selection to the following posts|assistant|officer|teacher|translator|भर्ती|विज्ञापन/i.test(
        line
      )
    )
    .slice(0, 8);

  const vacancies = extract([
    /(?:total\s+)?(?:number\s+of\s+)?vacancies\s*[:\-]?\s*([0-9,]+)/i,
    /(?:total\s+)?(?:number\s+of\s+)?posts\s*[:\-]?\s*([0-9,]+)/i,
    /([0-9,]+)\s+(?:vacancies|vacant\s+posts|posts)/i,
    /(?:a total of|total of)\s+([0-9,]+)\s+(?:posts|vacancies)/i,
    /कुल\s+पदों?\s*(?:की\s+संख्या)?\s*[:\-]?\s*([0-9,]+)/i,
  ]);

  const qualification = extract([
    /(?:educational|essential|minimum)\s+qualification\s*[:\-]?\s*(.{10,600}?)(?=age\s+limit|application\s+fee|pay\s+scale|salary|selection\s+process|important\s+dates|$)/i,
    /(?:required|prescribed)\s+qualification\s*[:\-]?\s*(.{10,600}?)(?=age\s+limit|application\s+fee|pay\s+scale|salary|selection\s+process|important\s+dates|$)/i,
    /शैक्षणिक\s+योग्यता\s*[:\-]?\s*(.{10,500}?)(?=आयु|शुल्क|वेतन|$)/i,
  ]);

  const ageLimit = extract([
    /age\s+limit\s*[:\-]?\s*(.{3,250}?)(?=application\s+fee|educational\s+qualification|pay\s+scale|important\s+dates|$)/i,
    /age\s+criteria\s*[:\-]?\s*(.{3,250}?)(?=application\s+fee|qualification|$)/i,
    /minimum\s+age\s*[:\-]?\s*(.{3,150}?)(?=maximum\s+age|relaxation|$)/i,
    /आयु\s+सीमा\s*[:\-]?\s*(.{3,200}?)(?=शुल्क|योग्यता|$)/i,
  ]);

  const applicationFee = extract([
    /application\s+fee\s*[:\-]?\s*(.{3,350}?)(?=important\s+dates|last\s+date|how\s+to\s+apply|$)/i,
    /examination\s+fee\s*[:\-]?\s*(.{3,350}?)(?=important\s+dates|last\s+date|$)/i,
    /registration\s+fee\s*[:\-]?\s*(.{3,250}?)(?=important\s+dates|last\s+date|$)/i,
    /आवेदन\s+शुल्क\s*[:\-]?\s*(.{3,250}?)(?=महत्वपूर्ण\s+तिथियां|अंतिम\s+तिथि|$)/i,
  ]);

  const applicationStartDate = extract([
    /(?:online\s+)?application\s+(?:starts?|start\s+date|beginning|from)\s*[:\-]?\s*([0-9]{1,2}[\/.-][0-9]{1,2}[\/.-][0-9]{2,4}|[0-9]{1,2}\s+[A-Za-z]+\s+[0-9]{4})/i,
    /registration\s+(?:starts?|start\s+date)\s*[:\-]?\s*([0-9]{1,2}[\/.-][0-9]{1,2}[\/.-][0-9]{2,4})/i,
    /आवेदन\s+प्रारंभ\s+तिथि\s*[:\-]?\s*([0-9]{1,2}[\/.-][0-9]{1,2}[\/.-][0-9]{2,4})/i,
  ]);

  const lastDate = extract([
    /(?:last\s+date|closing\s+date|last\s+date\s+for\s+application|application\s+ends)\s*[:\-]?\s*([0-9]{1,2}[\/.-][0-9]{1,2}[\/.-][0-9]{2,4}|[0-9]{1,2}\s+[A-Za-z]+\s+[0-9]{4})/i,
    /अंतिम\s+तिथि\s*[:\-]?\s*([0-9]{1,2}[\/.-][0-9]{1,2}[\/.-][0-9]{2,4})/i,
  ]);

  const examinationDate = extract([
    /(?:date\s+of\s+)?(?:written\s+)?examination\s*[:\-]?\s*([0-9]{1,2}[\/.-][0-9]{1,2}[\/.-][0-9]{2,4}|[0-9]{1,2}\s+[A-Za-z]+\s+[0-9]{4})/i,
    /exam(?:ination)?\s+date\s*[:\-]?\s*([0-9]{1,2}[\/.-][0-9]{1,2}[\/.-][0-9]{2,4})/i,
    /परीक्षा\s+तिथि\s*[:\-]?\s*([0-9]{1,2}[\/.-][0-9]{1,2}[\/.-][0-9]{2,4})/i,
  ]);

  const department = extract([
    /(?:name\s+of\s+the\s+)?department\s*[:\-]?\s*([^.;]{3,200})/i,
    /organisation\s*[:\-]?\s*([^.;]{3,200})/i,
  ]);

  return {
    job_title_candidates: titleCandidates,
    department,
    vacancies,
    qualification,
    age_limit: ageLimit,
    application_fee: applicationFee,
    application_start_date: applicationStartDate,
    last_date: lastDate,
    examination_date: examinationDate,
    apply_url: null,
    source_pdf_url: pdfUrl,
    extraction_note:
      "Improved automatic text extraction. Verify all information against the official notification before publishing.",
    extracted_text_excerpt: normalizedText.slice(0, 12000),
    extracted_text_length: normalizedText.length,
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

      // Process existing pending PDF records first. This includes older
      // discoveries that may no longer appear among the latest page links.
      // The global limit is checked only after a valid pending PDF is found.
      const { data: pendingDiscoveries, error: pendingError } = await supabase
        .from("government_job_discoveries")
        .select("id, pdf_url, discovered_url, extraction_status")
        .eq("source_id", source.id)
        .eq("extraction_status", "pending")
        .order("discovered_at", { ascending: true })
        .limit(50);

      if (pendingError) {
        throw new Error(`Could not load pending PDF notices: ${pendingError.message}`);
      }

      for (const discovery of pendingDiscoveries || []) {
        if (pdfsProcessed >= MAX_PDFS_PER_RUN) {
          break;
        }

        const pdfUrl =
          discovery.pdf_url ||
          (isPdfUrl(discovery.discovered_url) ? discovery.discovered_url : null);

        if (!pdfUrl || !isPdfUrl(pdfUrl)) {
          continue;
        }

        // Count only records that are actually eligible for PDF extraction.
        pdfsProcessed++;

        const { error: processingError } = await supabase
          .from("government_job_discoveries")
          .update({
            pdf_url: pdfUrl,
            extraction_status: "processing",
            extraction_error: null,
          })
          .eq("id", discovery.id)
          .eq("extraction_status", "pending");

        if (processingError) {
          console.error("Could not mark PDF as processing:", processingError);
          continue;
        }

        const pdfResult = await readJobPDF(pdfUrl);

        if (!pdfResult.success) {
          const needsOcr =
            pdfResult.error?.toLowerCase().includes("very little text") ||
            false;

          const { error: failureUpdateError } = await supabase
            .from("government_job_discoveries")
            .update({
              pdf_url: pdfUrl,
              extraction_status: needsOcr ? "needs_ocr" : "failed",
              extraction_error: pdfResult.error || "PDF reading failed.",
              extracted_at: new Date().toISOString(),
            })
            .eq("id", discovery.id);

          if (failureUpdateError) {
            console.error("Could not save PDF extraction failure:", failureUpdateError);
          }

          continue;
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
