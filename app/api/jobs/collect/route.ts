
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const maxDuration = 60;

type JobLink = {
  title: string;
  url: string;
};

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

function getTargetPages(sourceUrl: string): string[] {
  const hostname = new URL(sourceUrl).hostname.toLowerCase();

  if (hostname === "bpsc.bihar.gov.in") {
    return [
      "https://bpsc.bihar.gov.in/",
      "https://bpsc.bihar.gov.in/advertisement/",
    ];
  }

  if (hostname === "bssc.bihar.gov.in") {
    return [
      "https://bssc.bihar.gov.in/NoticeBoard.htm",
    ];
  }

  return [sourceUrl];
}

function findRecruitmentLinks(
  html: string,
  pageUrl: string
): JobLink[] {
  const results: JobLink[] = [];
  const seen = new Set<string>();
  const baseUrl = new URL(pageUrl);

  const keywords =
    /recruitment|advertisement|vacanc|career|apply|application|employment|job opening|job notice|public notice|examination notice|selection|appointment|post of|invitation of applications|भर्ती|नियुक्ति|विज्ञापन|रिक्ति|आवेदन/i;

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
      rowText = cleanText(
        html.slice(rowStart, rowEnd + 5)
      );
    }

    const title =
      anchorTitle.length >= 5
        ? anchorTitle
        : rowText;

    const context = `${anchorTitle} ${rowText}`;

    if (
      !href ||
      title.length < 5 ||
      title.length > 600 ||
      !keywords.test(context) ||
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

      if (
        url.href === pageUrl ||
        seen.has(url.href)
      ) {
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
      "User-Agent": "EduAxisIndiaJobCollector/2.0",
      Accept: "text/html,application/xhtml+xml",
    },
    signal: AbortSignal.timeout(15000),
    redirect: "follow",
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Website returned HTTP ${response.status}`);
  }

  const contentType =
    response.headers.get("content-type") || "";

  if (!contentType.includes("text/html")) {
    throw new Error("Source did not return an HTML webpage.");
  }

  const html = (await response.text()).slice(0, 2_000_000);

  return html;
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

  const authorization = request.headers.get("authorization");

  if (authorization !== `Bearer ${cronSecret}`) {
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

  const results: {
    source: string;
    pages_checked: number;
    found: number;
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
          console.error(
            "Page scan failed:",
            pageUrl,
            pageError
          );
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
      });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Unknown error";

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
        error: message,
      });
    }
  }

  return NextResponse.json({
    success: true,
    message: "Government job collection completed.",
    sources_checked: checked,
    candidate_links_found: discovered,
    results,
  });
}
