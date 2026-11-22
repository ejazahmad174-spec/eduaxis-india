
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

const MAX_RESPONSE_SIZE = 3 * 1024 * 1024;
const MAX_ITEMS_PER_SOURCE = 20;
const MAX_AGE_DAYS = 14;

function isAllowedUrl(value: string): boolean {
  try {
    const url = new URL(value);

    return (
      url.protocol === "https:" &&
      ALLOWED_HOSTS.includes(url.hostname)
    );
  } catch {
    return false;
  }
}

function cleanText(value: string): string {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<[^>]*>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_, n) => {
      const code = Number(n);
      return code <= 0x10ffff ? String.fromCodePoint(code) : "";
    })
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => {
      const code = parseInt(n, 16);
      return code <= 0x10ffff ? String.fromCodePoint(code) : "";
    })
    .replace(/\s+/g, " ")
    .trim();
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function getTag(block: string, tag: string): string {
  const safeTag = escapeRegExp(tag);

  const expression = new RegExp(
    `<${safeTag}\\b[^>]*>([\\s\\S]*?)<\\/${safeTag}\\s*>`,
    "i"
  );

  return cleanText(block.match(expression)?.[1] || "");
}

function absoluteUrl(link: string, base: string): string | null {
  try {
    const url = new URL(link.trim(), base);

    return isAllowedUrl(url.toString()) ? url.toString() : null;
  } catch {
    return null;
  }
}

function getCategory(title: string): string {
  const text = title.toLowerCase();

  if (/bihar|patna|nalanda/.test(text)) return "bihar";

  if (
    /education|school|university|ugc|teacher|exam|education policy/.test(text)
  ) {
    return "education";
  }

  if (/international|united nations|world|global|foreign/.test(text)) {
    return "international";
  }

  if (/bill|parliament|lok sabha|rajya sabha|act|supreme court/.test(text)) {
    return "polity";
  }

  if (/economy|budget|rbi|inflation|gdp|finance/.test(text)) {
    return "economy";
  }

  if (/scheme|ministry|government|cabinet|policy/.test(text)) {
    return "national";
  }

  return "general";
}

async function fetchPage(url: string): Promise<string> {
  if (!isAllowedUrl(url)) {
    throw new Error("Source URL is not approved");
  }

  const response = await fetch(url, {
    headers: {
      "User-Agent": USER_AGENT,
      Accept: "application/rss+xml, application/xml, text/xml",
    },
    signal: AbortSignal.timeout(20000),
    cache: "no-store",
    redirect: "manual",
  });

  if (response.status >= 300 && response.status < 400) {
    throw new Error("Redirect blocked for security");
  }

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const contentType = response.headers.get("content-type") || "";

  if (
    !/xml|rss|atom/i.test(contentType) &&
    !/text\/plain/i.test(contentType)
  ) {
    throw new Error(`Unexpected feed content type: ${contentType}`);
  }

  const contentLength = Number(
    response.headers.get("content-length") || 0
  );

  if (contentLength > MAX_RESPONSE_SIZE) {
    throw new Error("Feed response exceeds the size limit");
  }

  const body = await response.text();

  if (body.length > MAX_RESPONSE_SIZE) {
    throw new Error("Feed response exceeds the size limit");
  }

  if (!/<rss\b|<feed\b|<rdf:rdf\b/i.test(body)) {
    throw new Error("The source did not return a recognised RSS or Atom feed");
  }

  return body;
}

type NewsItem = {
  title: string;
  summary: string | null;
  source_url: string;
  original_published_at: string;
};

function parseRss(xml: string, baseUrl: string): NewsItem[] {
  const items: NewsItem[] = [];

  const rssBlocks = xml.match(/<item\b[\s\S]*?<\/item>/gi) || [];
  const atomBlocks = xml.match(/<entry\b[\s\S]*?<\/entry>/gi) || [];
  const blocks = rssBlocks.length > 0 ? rssBlocks : atomBlocks;

  const cutoff = Date.now() - MAX_AGE_DAYS * 24 * 60 * 60 * 1000;
  const seenUrls = new Set<string>();

  for (const block of blocks) {
    if (items.length >= MAX_ITEMS_PER_SOURCE) break;

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
    if (seenUrls.has(link)) continue;

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

    // Skip entries with an invalid date, but accept missing dates.
// The PIB feed does not currently provide publication dates.
if (date && (!parsedDate || isNaN(parsedDate.getTime()))) continue;

// Skip old entries only when a valid publication date exists.
if (parsedDate && parsedDate.getTime() < cutoff) continue;

    seenUrls.add(link);

    items.push({
      title: title.slice(0, 500),
      summary: summary ? summary.slice(0, 3000) : null,
      source_url: link,
      original_published_at: parsedDate.toISOString(),
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
    const body = await fetchPage(source.source_url);
    const items = parseRss(body, source.source_url);

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

    const { error: updateError } = await supabase!
      .from("current_affairs_sources")
      .update({
        last_checked_at: now,
        last_success_at: now,
        last_error: null,
        updated_at: now,
      })
      .eq("id", source.id);

    if (updateError) throw updateError;

    return {
      source: source.source_name,
      discovered: items.length,
      inserted,
      success: true,
    };
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unknown collection error";

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
      { error: "Could not load news sources" },
      { status: 500 }
    );
  }

  const results = [];

  for (const source of sources || []) {
    results.push(await collectSource(source));
  }

  const inserted = results.reduce(
    (total, result) =>
      total +
      ("inserted" in result && typeof result.inserted === "number"
        ? result.inserted
        : 0),
    0
  );

  return NextResponse.json({
    success: true,
    checked: results.length,
    inserted,
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
