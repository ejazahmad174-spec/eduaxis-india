import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import https from "node:https";
import type { RequestOptions } from "node:https";

const ALLOWED_ROOT_DOMAINS = [
  "bpsc.bihar.gov.in",
  "bssc.bihar.gov.in",
  "ctet.nic.in",
  "ssc.gov.in",
  "recruitment.ugc.ac.in",
  "upsc.gov.in",
] as const;

const MAX_REDIRECTS = 5;
const DEFAULT_TIMEOUT_MS = 15_000;

export type OfficialDownloadOptions = {
  maxBytes: number;
  timeoutMs?: number;
  accept: string;
  userAgent?: string;
};

export type OfficialDownloadResult = {
  status: number;
  finalUrl: string;
  contentType: string;
  contentLength: number | null;
  body: Buffer;
};

type SingleRequestResult = {
  status: number;
  location: string | null;
  contentType: string;
  contentLength: number | null;
  body: Buffer;
};

function isAllowedHostname(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/\.$/, "");

  if (!host || isIP(host) !== 0) {
    return false;
  }

  return ALLOWED_ROOT_DOMAINS.some(
    (domain) => host === domain || host.endsWith(`.${domain}`)
  );
}

function ipv4ToNumber(address: string): number | null {
  const parts = address.split(".");

  if (
    parts.length !== 4 ||
    parts.some(
      (part) =>
        !/^\d{1,3}$/.test(part) ||
        Number(part) < 0 ||
        Number(part) > 255
    )
  ) {
    return null;
  }

  return (
    ((Number(parts[0]) << 24) >>> 0) +
    (Number(parts[1]) << 16) +
    (Number(parts[2]) << 8) +
    Number(parts[3])
  ) >>> 0;
}

function isInIPv4Range(
  address: number,
  network: string,
  prefix: number
): boolean {
  const networkNumber = ipv4ToNumber(network);

  if (networkNumber === null) {
    return true;
  }

  const mask =
    prefix === 0
      ? 0
      : (0xffffffff << (32 - prefix)) >>> 0;

  return (address & mask) === (networkNumber & mask);
}

function isPublicIPv4(address: string): boolean {
  const number = ipv4ToNumber(address);

  if (number === null) {
    return false;
  }

  // Deny special-use, private, loopback, link-local, documentation,
  // benchmarking, multicast and reserved IPv4 ranges.
  const blockedRanges: Array<[string, number]> = [
    ["0.0.0.0", 8],
    ["10.0.0.0", 8],
    ["100.64.0.0", 10],
    ["127.0.0.0", 8],
    ["169.254.0.0", 16],
    ["172.16.0.0", 12],
    ["192.0.0.0", 24],
    ["192.0.2.0", 24],
    ["192.88.99.0", 24],
    ["192.168.0.0", 16],
    ["198.18.0.0", 15],
    ["198.51.100.0", 24],
    ["203.0.113.0", 24],
    ["224.0.0.0", 4],
    ["240.0.0.0", 4],
  ];

  return !blockedRanges.some(([network, prefix]) =>
    isInIPv4Range(number, network, prefix)
  );
}

async function resolvePublicIPv4(hostname: string): Promise<string> {
  const records = await lookup(hostname, {
    all: true,
    family: 4,
    verbatim: true,
  });

  if (!records.length) {
    throw new Error("The approved website has no usable IPv4 address.");
  }

  // Fail closed if DNS returns even one non-public IPv4 address.
  for (const record of records) {
    if (!isPublicIPv4(record.address)) {
      throw new Error(
        "The website resolved to a private or restricted IP address."
      );
    }
  }

  return records[0].address;
}

function validateUrl(value: string): URL {
  let url: URL;

  try {
    url = new URL(value);
  } catch {
    throw new Error("Invalid website or PDF URL.");
  }

  if (url.protocol !== "https:") {
    throw new Error("Only HTTPS official websites are permitted.");
  }

  if (url.username || url.password) {
    throw new Error("URLs containing login credentials are not permitted.");
  }

  if (url.port && url.port !== "443") {
    throw new Error("Only the standard HTTPS port is permitted.");
  }

  const hostname = url.hostname.toLowerCase().replace(/\.$/, "");

  if (!isAllowedHostname(hostname)) {
    throw new Error("This website is not in the approved domain list.");
  }

  url.hostname = hostname;
  url.hash = "";

  return url;
}

function parseContentLength(value: string | string[] | undefined): number | null {
  if (typeof value !== "string" || !/^\d+$/.test(value)) {
    return null;
  }

  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

async function requestPinned(
  url: URL,
  pinnedIp: string,
  options: OfficialDownloadOptions
): Promise<SingleRequestResult> {
  return new Promise((resolve, reject) => {
    let settled = false;
    let totalTimeout: ReturnType<typeof setTimeout> | undefined;

    const clearTotalTimeout = () => {
      if (totalTimeout) {
        clearTimeout(totalTimeout);
        totalTimeout = undefined;
      }
    };

    const fail = (error: Error) => {
      if (settled) return;
      settled = true;
      clearTotalTimeout();
      reject(error);
    };

    const requestOptions: RequestOptions = {
      method: "GET",
      headers: {
        "User-Agent": options.userAgent || "EduAxisIndiaJobCollector/4.0",
        Accept: options.accept,
        "Accept-Encoding": "identity",
        Connection: "close",
      },
      servername: url.hostname,
      rejectUnauthorized: true,
      // The hostname is resolved before this request and the socket is
      // pinned to that validated address to prevent a second DNS lookup.
      lookup: (((
        _hostname: string,
        _lookupOptions: unknown,
        callback: (error: NodeJS.ErrnoException | null, address: string, family: number) => void
      ) => {
        callback(null, pinnedIp, 4);
      }) as unknown) as NonNullable<RequestOptions["lookup"]>,
    };

    const request = https.request(url, requestOptions, (response) => {
      const status = response.statusCode || 0;
      const location =
        typeof response.headers.location === "string"
          ? response.headers.location
          : null;
      const contentType =
        typeof response.headers["content-type"] === "string"
          ? response.headers["content-type"]
          : "";
      const contentLength = parseContentLength(response.headers["content-length"]);
      const contentEncoding =
        typeof response.headers["content-encoding"] === "string"
          ? response.headers["content-encoding"].toLowerCase()
          : "identity";

      if ([301, 302, 303, 307, 308].includes(status)) {
        response.destroy();
        if (!settled) {
          settled = true;
          clearTotalTimeout();
          resolve({
            status,
            location,
            contentType,
            contentLength,
            body: Buffer.alloc(0),
          });
        }
        return;
      }

      if (contentLength !== null && contentLength > options.maxBytes) {
        response.destroy();
        fail(new Error("The download exceeds the permitted size limit."));
        return;
      }

      if (contentEncoding !== "identity" && contentEncoding !== "") {
        response.destroy();
        fail(new Error("Compressed website responses are not permitted."));
        return;
      }

      const chunks: Buffer[] = [];
      let receivedBytes = 0;

      response.on("data", (chunk: Buffer | string) => {
        if (settled) return;

        const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        receivedBytes += buffer.length;

        if (receivedBytes > options.maxBytes) {
          response.destroy();
          fail(new Error("The download exceeds the permitted size limit."));
          return;
        }

        chunks.push(buffer);
      });

      response.on("end", () => {
        if (settled) return;
        settled = true;
        clearTotalTimeout();
        resolve({
          status,
          location,
          contentType,
          contentLength,
          body: Buffer.concat(chunks, receivedBytes),
        });
      });

      response.on("error", (error) => fail(error));
    });

    const timeoutMs = options.timeoutMs || DEFAULT_TIMEOUT_MS;

    // setTimeout on the socket is an inactivity timeout. This separate
    // deadline also stops slow responses that keep sending occasional bytes.
    totalTimeout = setTimeout(() => {
      request.destroy(new Error("The website request exceeded its time limit."));
    }, timeoutMs);

    request.setTimeout(timeoutMs, () => {
      request.destroy(new Error("The website connection became inactive."));
    });

    request.on("error", (error) => fail(error));
    request.end();
  });
}

export async function fetchOfficialUrl(
  inputUrl: string,
  options: OfficialDownloadOptions
): Promise<OfficialDownloadResult> {
  if (!Number.isSafeInteger(options.maxBytes) || options.maxBytes <= 0) {
    throw new Error("A valid maximum download size is required.");
  }

  const timeoutMs = options.timeoutMs || DEFAULT_TIMEOUT_MS;

  if (!Number.isSafeInteger(timeoutMs) || timeoutMs <= 0) {
    throw new Error("A valid request timeout is required.");
  }

  let currentUrl = validateUrl(inputUrl);

  for (let redirectCount = 0; ; redirectCount++) {
    const pinnedIp = await resolvePublicIPv4(currentUrl.hostname);
    const result = await requestPinned(currentUrl, pinnedIp, {
      ...options,
      timeoutMs,
    });

    const isRedirect = [301, 302, 303, 307, 308].includes(result.status);

    if (!isRedirect) {
      return {
        status: result.status,
        finalUrl: currentUrl.toString(),
        contentType: result.contentType,
        contentLength: result.contentLength,
        body: result.body,
      };
    }

    if (!result.location) {
      throw new Error("The website returned a redirect without a destination.");
    }

    if (redirectCount >= MAX_REDIRECTS) {
      throw new Error("The website exceeded the maximum redirect limit.");
    }

    // Each redirect is independently checked against the allowlist and DNS.
    currentUrl = validateUrl(new URL(result.location, currentUrl).toString());
  }
}
