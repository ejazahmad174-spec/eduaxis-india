
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
  "www.rbi.org.in",
];

const USER_AGENT =
  "EduAxisIndia-CurrentAffairsBot/1.0 (+https://www.eduaxisindia.com)";

const MAX_RESPONSE_SIZE = 3 * 1024 * 1024;
const MAX_ITEMS_PER_SOURCE = 20;
const MAX_AGE_DAYS = 14;

function isAllowedUrl(value: string): boolean {
  try {
    const url = new URL(value);

    return (
      url.protocol === "https:" &&
      ALLOWED_HOSTS.includes(url.hostname.toLowerCase())
    );
  } catch {
    return false;
  }
}

function cleanText(value: string): string {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;|&#160;|&#xA0;/gi, " ")
    .replace(/&ensp;|&emsp;|&thinsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&ndash;/gi, "–")
    .replace(/&mdash;/gi, "—")
    .replace(/&rsquo;|&lsquo;/gi, "'")
    .replace(/&rdquo;|&ldquo;/gi, '"')
    .replace(/&hellip;/gi, "…")
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

function getCategory(title: string, sourceName: string): string {
  const text = [title, sourceName].join(" ").toLowerCase();
  const source = sourceName.toLowerCase();

  if (/education|school|university|ugc|teacher|exam|academic|scholarship|board result/.test(text)) {
    return "education";
  }

  if (
    source.includes("bihar") ||
    /\bbihar\b|patna|nalanda|gaya district|muzaffarpur|darbhanga|bhagalpur|purnia|magadh/.test(text)
  ) {
    return "bihar";
  }

  if (/international|united nations|world bank|imf|global|foreign affairs|bilateral|summit|diplomatic/.test(text)) {
    return "international";
  }

  return "national";
}

type FetchResult = {
  body: string | null;
  contentType: string;
  etag: string | null;
  lastModified: string | null;
  notModified: boolean;
};

async function fetchPage(
  initialUrl: string,
  previousEtag: string | null,
  previousLastModified: string | null
): Promise<FetchResult> {
  if (!isAllowedUrl(initialUrl)) {
    throw new Error("Source URL is not approved");
  }

  const headers: Record<string, string> = {
    "User-Agent": USER_AGENT,
    Accept: "application/rss+xml, application/xml, text/xml, text/html",
  };

  if (previousEtag) headers["If-None-Match"] = previousEtag;
  if (previousLastModified) headers["If-Modified-Since"] = previousLastModified;

  let currentUrl = initialUrl;
  let response: Response | null = null;

  for (let redirects = 0; redirects <= 3; redirects += 1) {
    if (!isAllowedUrl(currentUrl)) {
      throw new Error("Source redirect points to a host that is not allow-listed");
    }

    response = await fetch(currentUrl, {
      headers,
      signal: AbortSignal.timeout(20000),
      cache: "no-store",
      redirect: "manual",
    });

    if (![301, 302, 303, 307, 308].includes(response.status)) break;

    const location = response.headers.get("location");
    if (!location || redirects === 3) {
      throw new Error("Source returned too many or invalid redirects");
    }

    const nextUrl = new URL(location, currentUrl).toString();
    if (!isAllowedUrl(nextUrl)) {
      throw new Error("Source redirect points outside the approved source list");
    }

    currentUrl = nextUrl;
  }

  if (!response) throw new Error("Source did not return a response");

  const etag = response.headers.get("etag");
  const lastModified = response.headers.get("last-modified");
  const contentType = response.headers.get("content-type") || "";

  if (response.status === 304) {
    return { body: null, contentType, etag, lastModified, notModified: true };
  }

  if (!response.ok) throw new Error("HTTP " + response.status);

  const sourceHost = new URL(currentUrl).hostname.toLowerCase();
  const isApprovedHtmlSource =
    ["betastate.bihar.gov.in", "prsindia.org", "www.prsindia.org"].includes(sourceHost) &&
    /text\/html|application\/xhtml\+xml/i.test(contentType);

  if (!isApprovedHtmlSource && !/xml|rss|atom|text\/plain/i.test(contentType)) {
    throw new Error("Unexpected source content type: " + contentType);
  }

  const contentLength = Number(response.headers.get("content-length") || 0);
  if (contentLength > MAX_RESPONSE_SIZE) throw new Error("Feed response exceeds the size limit");

  const body = await response.text();
  if (body.length > MAX_RESPONSE_SIZE) throw new Error("Feed response exceeds the size limit");

  if (!isApprovedHtmlSource && !/<rss\b|<feed\b|<rdf:rdf\b/i.test(body)) {
    throw new Error("The source did not return a recognised RSS or Atom feed");
  }

  if (isApprovedHtmlSource && !/<html\b|<!doctype html/i.test(body)) {
    throw new Error("The Bihar government source did not return an HTML page");
  }

  return { body, contentType, etag, lastModified, notModified: false };
}

type NewsItem = {
  title: string;
  summary: string | null;
  source_url: string;
  original_published_at: string | null;
};

function parseRss(xml: string, baseUrl: string): NewsItem[] {
  const items: NewsItem[] = [];

  const rssBlocks = xml.match(/<item\b[\s\S]*?<\/item>/gi) || [];
  const atomBlocks = xml.match(/<entry\b[\s\S]*?<\/entry>/gi) || [];
  const blocks = rssBlocks.length > 0 ? rssBlocks : atomBlocks;

  const cutoff =
    Date.now() - MAX_AGE_DAYS * 24 * 60 * 60 * 1000;

  const seenUrls = new Set<string>();

  for (const block of blocks) {
    if (items.length >= MAX_ITEMS_PER_SOURCE) break;

    const title = getTag(block, "title");

    const linkTags = block.match(/<link\b[^>]*>/gi) || [];
    const preferredLink = linkTags.find((tag) => {
      const rel = tag.match(/rel=["']([^"']+)["']/i)?.[1]?.toLowerCase();
      return !rel || rel === "alternate";
    });
    const linkAttribute = preferredLink?.match(/href=["']([^"']+)["']/i)?.[1];

    const rawLink =
      linkAttribute ||
      getTag(block, "link") ||
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

    // Accept missing dates, but reject invalid dates.
    if (date && (!parsedDate || isNaN(parsedDate.getTime()))) {
      continue;
    }

    // Ignore old entries when a valid date is available.
    if (parsedDate && parsedDate.getTime() < cutoff) {
      continue;
    }

    seenUrls.add(link);

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

function parseBiharHtmlNews(html: string, baseUrl: string): NewsItem[] {
  const items: NewsItem[] = [];
  const cutoff = Date.now() - MAX_AGE_DAYS * 24 * 60 * 60 * 1000;
  const seenUrls = new Set<string>();
  const rows = html.match(/<tr\b[\s\S]*?<\/tr>/gi) || [];

  const addItem = (titleValue: string, rawUrl: string, context: string) => {
    const title = cleanText(titleValue);
    const link = absoluteUrl(rawUrl, baseUrl);
    if (!title || title.length < 18 || !link || seenUrls.has(link)) return;
    if (/^(home|about us|contact us|read more|view all|download|login|search|tender)$/i.test(title)) return;
    if (/privacy policy|terms and conditions|screen reader|skip navigation|website policies/i.test(title)) return;

    const dateMatch = context.match(/\b(?:0?[1-9]|[12]\d|3[01])[\s/-]+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*[\s,-]+20\d{2}\b|\b(?:0?[1-9]|[12]\d|3[01])[/-](?:0?[1-9]|1[0-2])[/-]20\d{2}\b/i);
    let publishedAt: string | null = null;
    if (dateMatch) {
      const parsed = new Date(dateMatch[0]);
      if (!Number.isNaN(parsed.getTime())) {
        if (parsed.getTime() < cutoff) return;
        publishedAt = parsed.toISOString();
      }
    }

    seenUrls.add(link);
    items.push({
      title: title.slice(0, 500),
      summary: context ? cleanText(context).slice(0, 1200) : null,
      source_url: link,
      original_published_at: publishedAt,
    });
  };

  for (const row of rows) {
    if (items.length >= MAX_ITEMS_PER_SOURCE) break;
    const anchors = [...row.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)];
    if (!anchors.length) continue;

    const candidates = anchors.map((match) => {
      const href = match[1].match(/href=["']([^"']+)["']/i)?.[1] || "";
      const title = cleanText(match[2]);
      return { href, title };
    }).filter((item) =>
      item.href &&
      item.title.length >= 18 &&
      !/^(home|about us|contact us|read more|view all|download|login|tender)$/i.test(item.title)
    );

    if (!candidates.length) continue;
    candidates.sort((left, right) => right.title.length - left.title.length);
    const chosen = candidates[0];
    const rowText = cleanText(row).replace(chosen.title, "").slice(0, 1200);
    addItem(chosen.title, chosen.href, rowText);
  }

  if (items.length === 0) {
    const anchors = [...html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)];
    for (const match of anchors) {
      if (items.length >= MAX_ITEMS_PER_SOURCE) break;
      const href = match[1].match(/href=["']([^"']+)["']/i)?.[1] || "";
      const title = cleanText(match[2]);
      if (title.length < 24 || !href) continue;
      addItem(title, href, "");
    }
  }

  return items;
}

function parsePrsHtmlNews(html: string, baseUrl: string): NewsItem[] {
  const items: NewsItem[] = [];
  const cutoff = Date.now() - MAX_AGE_DAYS * 24 * 60 * 60 * 1000;
  const seen = new Set<string>();

  const add = (block: string) => {
    const anchors = [...block.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)];
    const candidate = anchors
      .map((match) => ({
        href: match[1].match(/href=["']([^"']+)["']/i)?.[1] || "",
        title: cleanText(match[2]),
      }))
      .filter((entry) =>
        entry.href &&
        entry.title.length >= 24 &&
        !/^(home|about|contact|careers|read more|view all|search|login|menu)$/i.test(entry.title)
      )
      .sort((left, right) => right.title.length - left.title.length)[0];

    if (!candidate) return;
    const link = absoluteUrl(candidate.href, baseUrl);
    if (!link || seen.has(link)) return;
    const parsedDateText = cleanText(block).match(/\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2},?\s+20\d{2}\b/i)?.[0];
    const parsedDate = parsedDateText ? new Date(parsedDateText) : null;
    if (parsedDate && !Number.isNaN(parsedDate.getTime()) && parsedDate.getTime() < cutoff) return;
    const summary = cleanText(block)
      .replace(candidate.title, "")
      .replace(parsedDateText || "", "")
      .slice(0, 1600);

    seen.add(link);
    items.push({
      title: candidate.title.slice(0, 500),
      summary: summary || null,
      source_url: link,
      original_published_at: parsedDate && !Number.isNaN(parsedDate.getTime())
        ? parsedDate.toISOString()
        : null,
    });
  };

  const articleBlocks = html.match(/<article\b[\s\S]*?<\/article>/gi) || [];
  for (const block of articleBlocks) {
    if (items.length >= MAX_ITEMS_PER_SOURCE) break;
    add(block);
  }

  // PRS pages can also render recent legislative updates as linked cards
  // without semantic <article> wrappers. This fallback only accepts internal
  // news/report/Bill routes on the allow-listed PRS host.
  if (items.length === 0) {
    const anchors = [...html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)];
    for (const match of anchors) {
      if (items.length >= MAX_ITEMS_PER_SOURCE) break;
      const href = match[1].match(/href=["']([^"']+)["']/i)?.[1] || "";
      const title = cleanText(match[2]);
      if (
        !href ||
        title.length < 28 ||
        !/(bill|legislative|parliament|state|analysis|explained|budget|finance|report|committee|law|policy)/i.test(title)
      ) continue;

      const link = absoluteUrl(href, baseUrl);
      if (!link || seen.has(link)) continue;
      seen.add(link);
      items.push({
        title: title.slice(0, 500),
        summary: null,
        source_url: link,
        original_published_at: null,
      });
    }
  }

  return items;
}

async function updateSourceSuccess(
  sourceId: string,
  now: string,
  etag: string | null,
  lastModified: string | null
) {
  const { error } = await supabase!
    .from("current_affairs_sources")
    .update({
      last_checked_at: now,
      last_success_at: now,
      last_error: null,
      etag,
      last_modified: lastModified,
      updated_at: now,
    })
    .eq("id", sourceId);

  if (error) throw error;
}

async function collectSource(source: {
  id: string;
  source_name: string;
  source_url: string;
  etag: string | null;
  last_modified: string | null;
}) {
  const now = new Date().toISOString();

  try {
    const fetched = await fetchPage(
      source.source_url,
      source.etag,
      source.last_modified
    );

    // The server confirms that the cached feed has not changed.
    if (fetched.notModified) {
      await updateSourceSuccess(
        source.id,
        now,
        fetched.etag || source.etag,
        fetched.lastModified || source.last_modified
      );

      return {
        source: source.source_name,
        success: true,
        not_modified: true,
        discovered: 0,
        inserted: 0,
      };
    }

    const sourceHost = new URL(source.source_url).hostname.toLowerCase();
    const isHtmlSource = /html/i.test(fetched.contentType);
    const items = isHtmlSource
      ? sourceHost === "prsindia.org" || sourceHost === "www.prsindia.org"
        ? parsePrsHtmlNews(fetched.body || "", source.source_url)
        : parseBiharHtmlNews(fetched.body || "", source.source_url)
      : parseRss(fetched.body || "", source.source_url);

    const records = items.map((item) => ({
      source_id: source.id,
      source_name: source.source_name,
      title: item.title,
      summary: null,
      source_excerpt: item.summary,
      source_url: item.source_url,
      category: getCategory(item.title, source.source_name),
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

    await updateSourceSuccess(
      source.id,
      now,
      fetched.etag || source.etag,
      fetched.lastModified || source.last_modified
    );

    return {
      source: source.source_name,
      success: true,
      not_modified: false,
      discovered: items.length,
      inserted,
    };
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unknown collection error";

    const { error: updateError } = await supabase!
      .from("current_affairs_sources")
      .update({
        last_checked_at: now,
        last_error: message.slice(0, 1000),
        updated_at: now,
      })
      .eq("id", source.id);

    if (updateError) {
      return {
        source: source.source_name,
        success: false,
        error: `${message}; source status update also failed`,
      };
    }

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
    .select(
      "id, source_name, source_url, etag, last_modified"
    )
    .eq("is_active", true);

  if (error) {
    return NextResponse.json(
      { error: "Could not load news sources" },
      { status: 500 }
    );
  }

  const results = await Promise.all(
    (sources || []).map((source) => collectSource(source))
  );

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
