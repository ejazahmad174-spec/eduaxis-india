
import pdfParse from "pdf-parse";

const MAX_PDF_SIZE = 10 * 1024 * 1024;
const MAX_OCR_PDF_SIZE = 1 * 1024 * 1024;
const MAX_EXTRACTED_TEXT = 150_000;

export type PDFReadingResult = {
  success: boolean;
  text: string;
  pages: number;
  error?: string;
};

type OCRResponse = {
  IsErroredOnProcessing?: boolean;
  ErrorMessage?: string | string[];
  ParsedResults?: Array<{
    ParsedText?: string;
  }>;
};

function cleanText(value: string): string {
  return value
    .replace(/\u0000/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, MAX_EXTRACTED_TEXT);
}

async function readWithOCR(buffer: Buffer): Promise<string> {
  const apiKey = process.env.OCR_SPACE_API_KEY;

  if (!apiKey) {
    throw new Error("OCR API key is missing from the server environment.");
  }

  if (buffer.length > MAX_OCR_PDF_SIZE) {
    throw new Error(
      "This scanned PDF exceeds the 1 MB limit of the free OCR service."
    );
  }

  const formData = new FormData();

  const pdfBlob = new Blob(
    [new Uint8Array(buffer)],
    { type: "application/pdf" }
  );

  formData.append("file", pdfBlob, "government-notice.pdf");
  formData.append("language", "eng");
  formData.append("filetype", "PDF");
  formData.append("isOverlayRequired", "false");
  formData.append("OCREngine", "2");

  const response = await fetch(
    "https://api.ocr.space/parse/image",
    {
      method: "POST",
      headers: {
        apikey: apiKey,
      },
      body: formData,
      signal: AbortSignal.timeout(45000),
      cache: "no-store",
    }
  );

  if (!response.ok) {
    throw new Error(`OCR service failed: HTTP ${response.status}`);
  }

  const result = (await response.json()) as OCRResponse;

  if (result.IsErroredOnProcessing) {
    const message = Array.isArray(result.ErrorMessage)
      ? result.ErrorMessage.join(", ")
      : result.ErrorMessage;

    throw new Error(message || "OCR could not process this PDF.");
  }

  const extractedText = cleanText(
    (result.ParsedResults || [])
      .map((page) => page.ParsedText || "")
      .join("\n\n")
  );

  if (extractedText.length < 30) {
    throw new Error("OCR could not extract readable text from this PDF.");
  }

  return extractedText;
}

export async function readJobPDF(
  pdfUrl: string
): Promise<PDFReadingResult> {
  let buffer: Buffer | null = null;
  let pages = 0;
  let normalExtractionError = "";

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

    buffer = Buffer.from(arrayBuffer);

    if (
      buffer.length < 5 ||
      buffer.subarray(0, 5).toString("ascii") !== "%PDF-"
    ) {
      throw new Error("The downloaded document is not a valid PDF.");
    }

    try {
      const parsed = await pdfParse(buffer);
      pages = parsed.numpages || 0;

      const text = cleanText(parsed.text || "");

      if (text.length >= 100) {
        return {
          success: true,
          text,
          pages,
        };
      }

      normalExtractionError =
        "Normal PDF extraction returned very little text.";
    } catch (error) {
      normalExtractionError =
        error instanceof Error
          ? error.message
          : "Normal PDF extraction failed.";
    }

    const ocrText = await readWithOCR(buffer);

    return {
      success: true,
      text: ocrText,
      pages,
    };
  } catch (error) {
    const ocrError =
      error instanceof Error
        ? error.message
        : "Unable to read the PDF.";

    return {
      success: false,
      text: "",
      pages,
      error: normalExtractionError
        ? `${normalExtractionError} OCR fallback: ${ocrError}`
        : ocrError,
    };
  }
}
