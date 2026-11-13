
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const maxDuration = 60;

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

function findRecruitmentLinks(html: string, sourceUrl: string) {
  const results: {
    title: string;
    url: string;
  }[] = [];

  const keywords =
    /recruitment|notification|advertisement|vacancy|vacancies|career|apply online|employment|job opening|job notice|public notice|latest notice|examination notice|selection|invitation of applications/i;

  const baseUrl = new URL(sourceUrl);
  const anchors = html.matchAll(
    /<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi
  );

  for (const match of anchors) {
    const href = match[1].trim();
    const title = cleanText(match[2]);

    if (!href || !title || title.length < 5 || title.length > 300) {
      continue;
    }

    if (!keywords.test(title)) {
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

      if (url.href === sourceUrl || results.some((item) => item.url === url.href)) {
        continue;
      }

      results.push({
        title,
        url: url.href,
      });

      if (results.length >= 50) break;
    } catch {
      continue;
    }
  }

  return results;
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
    found: number;
    error?: string;
  }[] = [];

  for (const source of sources || []) {
    checked++;

    try {
      const response = await fetch(source.source_url, {
        method: "GET",
        headers: {
          "User-Agent": "EduAxisIndiaJobCollector/1.0",
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

      const html = (await response.text()).slice(0, 2_000_000);

      const links = findRecruitmentLinks(html, source.source_url);

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

      await supabase
        .from("government_job_sources")
        .update({
          last_checked_at: new Date().toISOString(),
          last_success_at: new Date().toISOString(),
          last_error: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", source.id);

      results.push({
        source: source.source_name,
        found: links.length,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown error";

      console.error("Job source collection failed:", source.source_name, message);

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
