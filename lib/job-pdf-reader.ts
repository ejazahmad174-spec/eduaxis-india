
import pdfParse from "pdf-parse";

const MAX_PDF_SIZE = 10 * 1024 * 1024;
const MAX_EXTRACTED_TEXT = 150_000;

export type PDFReadingResult = {
  success: boolean;
  text: string;
  pages: number;
  error?: string;
};

export async function readJobPDF(
  pdfUrl: string
): Promise<PDFReadingResult> {
  try {
    const url = new URL(pdfUrl);

    if (!["http:", "https:"].includes(url.protocol)) {
      throw new Error("Invalid PDF URL.");
    }

    const response = await fetch(url.toString(), {
      method: "GET",
      headers: {
        "User-Agent": "EduAxisIndiaJobCollector/3.0",
        Accept: "application/pdf,application/octet-stream",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(20000),
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(`PDF download failed: HTTP ${response.status}`);
    }

    const contentLength = Number(
      response.headers.get("content-length") || 0
    );

    if (contentLength > MAX_PDF_SIZE) {
      throw new Error("PDF is larger than the permitted 10 MB limit.");
    }

    const arrayBuffer = await response.arrayBuffer();

    if (arrayBuffer.byteLength > MAX_PDF_SIZE) {
      throw new Error("Downloaded PDF exceeds the 10 MB limit.");
    }

    const buffer = Buffer.from(arrayBuffer);

    if (
      buffer.length < 5 ||
      buffer.subarray(0, 5).toString("ascii") !== "%PDF-"
    ) {
      throw new Error("The downloaded document is not a valid PDF.");
    }

    const parsed = await pdfParse(buffer);

    const text = parsed.text
      .replace(/\u0000/g, " ")
      .replace(/[ \t]+/g, " ")
      .replace(/\n{3,}/g, "\n\n")
      .trim()
      .slice(0, MAX_EXTRACTED_TEXT);

    if (text.length < 100) {
      throw new Error(
        "Very little text was extracted. The PDF may be scanned or image-based."
      );
    }

    return {
      success: true,
      text,
      pages: parsed.numpages || 0,
    };
  } catch (error) {
    return {
      success: false,
      text: "",
      pages: 0,
      error:
        error instanceof Error
          ? error.message
          : "Unable to read the PDF.",
    };
  }
}
