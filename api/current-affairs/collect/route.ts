
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const cronSecret = process.env.CRON_SECRET;

const supabase =
  supabaseUrl && serviceRoleKey
    ? createClient(supabaseUrl, serviceRoleKey, {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      })
    : null;

const ALLOWED_HOSTS = [
  "pib.gov.in",
  "www.pib.gov.in",
  "prsindia.org",
  "www.prsindia.org",
  "betastate.bihar.gov.in",
];

const USER_AGENT =
  "EduAxisIndia-CurrentAffairsBot/1.0 (+https://eduaxisindia.com)";

function cleanText(value: string): string {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<[^>]*>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_, n) =>
      String.fromCodePoint(Number(n))
    )
    .replace(/&#x([0-9a-f]+);/gi, (_, n) =>
      String.fromCodePoint(parseInt(n, 16))
    )
    .replace(/\s+/g, " ")
    .trim();
}

function getTag(block: string, tag: string): string {
  const expression = new RegExp(
    `<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`,
    "i"
  );
  return cleanText(block.match(expression)?.[1] || "");
}

function getCategory(title: string): string {
  const text = title.toLowerCase();

  if (/bihar|patna|nalanda/.test(text)) return "bihar";
  if (/education|school|university|ugc|teacher|exam|education policy/.test(text))
    return "education";
  if (/international|united nations|world|global|foreign/.test(text))
    return "international";
  if (/bill|parliament|lok sabha|rajya sabha|act|supreme court/.test(text))
    return "polity";
  if (/economy|budget|rbi|inflation|gdp|finance/.test(text))
    return "economy";
  if (/scheme|ministry|government|cabinet|policy/.test(text))
    return "national";

  return "general";
}

function isAllowedUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return (
      parsed.protocol === "https:" &&
      ALLOWED_HOSTS.includes(parsed.hostname)
    );
  } catch {
    return false;
  }
}

function absoluteUrl(link: string, base: string): string | null {
  try {
    const url = new URL(link, base);
    return isAllowedUrl(url.toString()) ? url.toString() : null;
  } catch {
    return null;
  }
}

async function fetchPage(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: {
      "User-Agent": USER_AGENT,
      Accept: "application/rss+xml, application/xml, text/xml, text/html",
    },
    signal: AbortSignal.timeout(20000),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  return response.text();
}

type NewsItem = {
  title: string;
  summary: string | null;
  source_url: string;
  original_published_at: string | null;
};

function parseRss(xml: string, baseUrl: string): NewsItem[] {
  const items: NewsItem[] = [];
  const blocks = xml.match(/<item\b[\s\S]*?<\/item>/gi) || [];

  const entries =
    blocks.length > 0
      ? blocks
      : xml.match(/<entry\b[\s\S]*?<\/entry>/gi) || [];

  for (const block of entries) {
    const title = getTag(block, "title");

    const linkTag = block.match(/<link\b[^>]*>/i)?.[0] || "";
    const linkAttribute = linkTag.match(/href=["']([^"']+)["']/i)?.[1];

    const rawLink =
      getTag(block, "link") ||
      linkAttribute ||
      getTag(block, "guid") ||
      getTag(block, "id");

    const link = absoluteUrl(rawLink, baseUrl);

    if (!title || title.length < 10 || !link) continue;

    const summary =
      getTag(block, "description") ||
      getTag(block, "summary") ||
      getTag(block, "content:encoded");

    const date =
      getTag(block, "pubDate") ||
      getTag(block, "published") ||
      getTag(block, "updated") ||
      getTag(block, "dc:date");

    const parsedDate = date ? new Date(date) : null;

    items.push({
      title: title.slice(0, 500),
      summary: summary ? summary.slice(0, 3000) : null,
      source_url: link,
      original_published_at:
        parsedDate && !isNaN(parsedDate.getTime())
          ? parsedDate.toISOString()
          : null,
    });
  }

  return items;
}

function parseHtml(html: string, baseUrl: string): NewsItem[] {
  const items: NewsItem[] = [];
  const anchors = html.match(/<a\b[^>]*>[\s\S]*?<\/a>/gi) || [];

  for (const anchor of anchors) {
    const href = anchor.match(/href=["']([^"']+)["']/i)?.[1];
    const title = cleanText(anchor.replace(/<a\b[^>]*>|<\/a>/gi, ""));

    if (!href || title.length < 25 || title.length > 250) continue;

    const link = absoluteUrl(href, baseUrl);
    if (!link || link === baseUrl) continue;

    if (/javascript:|mailto:|#|\/(login|contact|about|privacy|terms)/i.test(href))
      continue;

    items.push({
      title: title.slice(0, 500),
      summary: null,
      source_url: link,
      original_published_at: null,
    });
  }

  return items;
}

async function collectSource(source: {
  id: string;
  source_name: string;
  source_url: string;
}) {
  const now = new Date().toISOString();

  try {
    if (!isAllowedUrl(source.source_url)) {
      throw new Error("Source host is not in the approved domain list");
    }

    const body = await fetchPage(source.source_url);
    const isXml =
      /<rss\b|<feed\b|<rdf:rdf\b/i.test(body);

    const items = isXml
      ? parseRss(body, source.source_url)
      : parseHtml(body, source.source_url);

    const records = items.map((item) => ({
      source_id: source.id,
      source_name: source.source_name,
      title: item.title,
      summary: item.summary,
      source_url: item.source_url,
      category: getCategory(item.title),
      original_published_at: item.original_published_at,
      fetched_at: now,
      status: "pending",
    }));

    let inserted = 0;

    if (records.length > 0) {
      const { data, error } = await supabase!
        .from("current_affairs_items")
        .upsert(records, {
          onConflict: "source_url",
          ignoreDuplicates: true,
        })
        .select("id");

      if (error) throw error;
      inserted = data?.length || 0;
    }

    await supabase!
      .from("current_affairs_sources")
      .update({
        last_checked_at: now,
        last_success_at: now,
        last_error: null,
        updated_at: now,
      })
      .eq("id", source.id);

    return {
      source: source.source_name,
      discovered: items.length,
      inserted,
      success: true,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown collection error";

    await supabase!
      .from("current_affairs_sources")
      .update({
        last_checked_at: now,
        last_error: message.slice(0, 1000),
        updated_at: now,
      })
      .eq("id", source.id);

    return {
      source: source.source_name,
      success: false,
      error: message,
    };
  }
}

async function handleCollection(request: NextRequest) {
  if (!cronSecret || !supabase) {
    return NextResponse.json(
      { error: "Server configuration is incomplete" },
      { status: 500 }
    );
  }

  const authorization = request.headers.get("authorization");

  if (authorization !== `Bearer ${cronSecret}`) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  const { data: sources, error } = await supabase
    .from("current_affairs_sources")
    .select("id, source_name, source_url")
    .eq("is_active", true);

  if (error) {
    return NextResponse.json(
      { error: "Could not load news sources", details: error.message },
      { status: 500 }
    );
  }

  const results = [];

  for (const source of sources || []) {
    results.push(await collectSource(source));
  }

  return NextResponse.json({
    success: true,
    checked: results.length,
    inserted: results.reduce(
  (total, result) =>
    total + (result && typeof result.inserted === "number"
      ? result.inserted
      : 0),
  0
),
    results,
    collected_at: new Date().toISOString(),
  });
}

export async function GET(request: NextRequest) {
  return handleCollection(request);
}

export async function POST(request: NextRequest) {
  return handleCollection(request);
}
