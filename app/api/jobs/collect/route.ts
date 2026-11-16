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
