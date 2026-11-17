
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
  | "government_job"
  | "recruitment_notice"
  | "admit_card"
  | "result_answer_key"
  | "syllabus"
  | "other_update";

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
  return /\.pdf(?:$|[?#])/i.test(value);
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

  if (/certificate|marksheet|mark sheet|digilocker|credential|प्रमाणपत्र/i.test(text)) {
    return "certificate";
  }

  if (/admit card|answer key|answer-key|result|exam date|examination schedule|exam schedule|exam city|hall ticket|प्रवेश पत्र|उत्तर कुंजी|परिणाम/i.test(text)) {
    return "examination";
  }

  if (/ctet|teacher eligibility|eligibility test|eligibility certificate|application form|apply online|online application|registration|पात्रता परीक्षा/i.test(text)) {
    return "teacher_eligibility";
  }

  if (/recruitment|vacancy|vacancies|advertisement|appointment|selection|career|job opening|भर्ती|नियुक्ति|रिक्ति/i.test(text)) {
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

    const title = anchorTitle.length >= 5 ? anchorTitle : rowText;
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

      if (results.length >= 50) break;
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
    .replace(/\u0000/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  const compactText = normalizedText.replace(/\s+/g, " ");
  const lines = normalizedText
    .split(/\n+/)
    .map((line) => line.trim())
    .filter((line) => line.length > 2);

  function clean(value: string | null | undefined, max = 1000): string | null {
    if (!value) return null;
    const result = value.replace(/\s+/g, " ").trim().replace(/[.;,:\s]+$/, "");
    return result ? result.slice(0, max) : null;
  }

  function firstMatch(patterns: RegExp[], source = compactText): string | null {
    for (const pattern of patterns) {
      const match = source.match(pattern);
      if (match?.[1]) return clean(match[1]);
    }
    return null;
  }

  function getSection(start: RegExp, end: RegExp, max = 1500): string | null {
    const match = start.exec(compactText);
    if (!match || match.index === undefined) return null;
    const afterStart = compactText.slice(match.index + match[0].length);
    const endMatch = end.exec(afterStart);
    return clean(afterStart.slice(0, endMatch ? endMatch.index : max), max);
  }

  function wordsToNumber(value: string): string | null {
    const input = value.toLowerCase().replace(/-/g, " ").trim();
    if (/^[\d,]+$/.test(input)) return String(Number(input.replace(/,/g, "")));

    const numbers: Record<string, number> = {
      zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5,
      six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
      eleven: 11, twelve: 12, thirteen: 13, fourteen: 14,
      fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18,
      nineteen: 19, twenty: 20, thirty: 30, forty: 40,
      fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90,
      hundred: 100,
    };

    let total = 0;
    let current = 0;
    for (const word of input.split(/\s+/)) {
      if (!word || word === "and") continue;
      if (!(word in numbers)) return null;
      const value = numbers[word];
      if (value === 100) current = (current || 1) * 100;
      else current += value;
    }
    total += current;
    return total > 0 ? String(total) : null;
  }

  // Handles notices such as: "Eighty vacancies for the post of ..."
  const vacancyMatch = compactText.match(
    /\b((?:\d[\d,]*|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety)(?:[ -]+(?:one|two|three|four|five|six|seven|eight|nine|ten))?)\s+vacancies?\s+for\s+the\s+post\s+of\s+(.{5,180}?)(?=\s+in\s+|\s+under\s+|\.|$)/i
  );

  const vacancies = vacancyMatch
    ? wordsToNumber(vacancyMatch[1])
    : firstMatch([
        /(?:total\s+)?(?:number\s+of\s+)?vacancies\s*[:\-]?\s*([\d,]+)/i,
        /([\d,]+)\s+(?:vacancies|vacant\s+posts|posts)/i,
        /(?:total\s+of)\s+([\d,]+)\s+(?:posts|vacancies)/i,
      ]);

  const jobTitle = clean(vacancyMatch?.[2], 200);
  const titleCandidates = [
    ...(jobTitle ? [jobTitle] : []),
    ...lines.filter((line) =>
      /special advertisement|assistant|officer|teacher|translator|recruitment|vacancy details/i.test(line)
    ),
  ].filter((item, index, array) => array.indexOf(item) === index).slice(0, 8);

  const payScale = getSection(/\bPAY\s+SCALE\s*:/i, /\bAGE\s*:/i, 500);
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
    essentialBlock?.replace(/^EDUCATIONAL\s*/i, "").replace(/\s+DESIRABLE\s+QUALIFICATIONS?[\s\S]*$/i, ""),
    800
  );

  const desirableQualification = firstMatch([
    /DESIRABLE\s+QUALIFICATIONS?\s*:\s*(.{5,500}?)(?=\s+NOTE\s+\d|\s+DUTIES\s*:|$)/i,
  ]);

  const feeBlock = getSection(
    /\bAPPLICATION\s+FEE\s*:/i,
    /\bCONCESSIONS\s*(?:AND|&)\s*RELAXATIONS\b/i,
    700
  );
  const applicationFee = feeBlock || firstMatch([
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

  const department = vacancyMatch
    ? firstMatch([
        /Eighty\s+vacancies\s+for\s+the\s+post\s+of\s+.{5,180}?\s+in\s+(.{5,220}?)(?=\.\s*RESERVATION\s+POSITION)/i,
        /\d+\s+vacancies\s+for\s+the\s+post\s+of\s+.{5,180}?\s+in\s+(.{5,220}?)(?=\.\s*RESERVATION\s+POSITION)/i,
      ])
    : firstMatch([
        /(?:name\s+of\s+the\s+)?department\s*[:\-]?\s*([^.;]{3,200})/i,
        /organisation\s*[:\-]?\s*([^.;]{3,200})/i,
      ]);

  const categoryWiseVacancies = firstMatch([
    /RESERVATION\s+POSITION\s*:\s*\(([^)]{5,200})\)/i,
  ]);

  const applyUrl = compactText.match(/https?:\/\/upsconline\.nic\.in\/ora\/?/i)?.[0] || null;

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
  const cronSecret = process.env.CRON_SECRET;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  const publishableKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json(
      { error: "Collector configuration is incomplete." },
      { status: 500 }
    );
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  const authorization = request.headers.get("authorization") || "";

  const isCronRequest = Boolean(
    cronSecret && authorization === `Bearer ${cronSecret}`
  );

  // Cron requests use CRON_SECRET.
  // Manual requests must come from a signed-in administrator.
  if (!isCronRequest) {
    const accessToken = authorization.startsWith("Bearer ")
      ? authorization.slice(7).trim()
      : "";

    if (!accessToken) {
      return NextResponse.json(
        { error: "Unauthorized. Please sign in as an administrator." },
        { status: 401 }
      );
    }

    if (!publishableKey) {
      return NextResponse.json(
        { error: "Supabase publishable key is not configured." },
        { status: 500 }
      );
    }

    const authClient = createClient(supabaseUrl, publishableKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    const { data: userData, error: authError } =
      await authClient.auth.getUser(accessToken);

    if (authError || !userData.user) {
      return NextResponse.json(
        { error: "Your session is invalid or expired. Please sign in again." },
        { status: 401 }
      );
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", userData.user.id)
      .maybeSingle();

    if (profileError) {
      console.error("Could not verify administrator role:", profileError);

      return NextResponse.json(
        { error: "Could not verify administrator permissions." },
        { status: 500 }
      );
    }

    if (profile?.role !== "admin") {
      return NextResponse.json(
        { error: "Administrator access is required." },
        { status: 403 }
      );
    }
  }

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

  // Process UPSC first so its pending recruitment PDFs are not delayed
  // by earlier sources when the per-run PDF limit is reached.
  const orderedSources = [...(sources || [])].sort((a, b) => {
    const aPriority = /\bUPSC\b/i.test(a.source_name || "") ? 0 : 1;
    const bPriority = /\bUPSC\b/i.test(b.source_name || "") ? 0 : 1;
    return aPriority - bPriority;
  });

  for (const source of orderedSources) {
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

      const { data: pendingDiscoveries, error: pendingError } =
        await supabase
          .from("government_job_discoveries")
          .select("id, pdf_url, discovered_url, extraction_status")
          .eq("source_id", source.id)
          .in("extraction_status", ["pending", "needs_ocr", "failed"])
          .order("discovered_at", { ascending: true })
          .limit(50);

      if (pendingError) {
        throw new Error(
          `Could not load pending PDF notices: ${pendingError.message}`
        );
      }

      for (const discovery of pendingDiscoveries || []) {
        if (pdfsProcessed >= MAX_PDFS_PER_RUN) {
          break;
        }

        const pdfUrl =
          discovery.pdf_url ||
          (isPdfUrl(discovery.discovered_url)
            ? discovery.discovered_url
            : null);

        if (!pdfUrl || !isPdfUrl(pdfUrl)) {
          continue;
        }

        pdfsProcessed++;

        const { error: processingError } = await supabase
          .from("government_job_discoveries")
          .update({
            pdf_url: pdfUrl,
            extraction_status: "processing",
            extraction_error: null,
          })
          .in("extraction_status", ["pending", "needs_ocr", "failed"])
          .eq("extraction_status", "pending");

        if (processingError) {
          console.error(
            "Could not mark PDF as processing:",
            processingError
          );
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
              extraction_error:
                pdfResult.error || "PDF reading failed.",
              extracted_at: new Date().toISOString(),
            })
            .eq("id", discovery.id);

          if (failureUpdateError) {
            console.error(
              "Could not save PDF extraction failure:",
              failureUpdateError
            );
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
          console.error(
            "Could not save extracted PDF details:",
            updateError
          );
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
