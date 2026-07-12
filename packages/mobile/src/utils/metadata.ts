export interface MetadataResult {
  title: string | null;
  image: string | null;
  description: string | null;
  url: string;
}

export class ProfileAuthRequiredError extends Error {
  constructor(platform: string) {
    super(`${platform} authentication required`);
    this.name = "ProfileAuthRequiredError";
  }
}

// Fallback UA used when the caller doesn't supply one (e.g. the Bun test script).
const UA_FALLBACK =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148";

/** Extract a single OG meta tag value from raw HTML. Handles both attribute orderings. */
function parseMetaTag(html: string, property: string): string | null {
  // <meta property="og:foo" content="value"> or <meta content="value" property="og:foo">
  const escaped = property.replace(":", "\\:");
  const patterns = [
    new RegExp(
      `<meta[^>]+property=["']${escaped}["'][^>]+content=["']([^"']+)["']`,
      "i",
    ),
    new RegExp(
      `<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${escaped}["']`,
      "i",
    ),
  ];
  for (const re of patterns) {
    const m = html.match(re);
    if (m?.[1]) return decodeHTMLEntities(m[1]);
  }
  return null;
}

/** Extract <title> tag content as a fallback. */
function parseTitle(html: string): string | null {
  const m = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  return m?.[1] ? decodeHTMLEntities(m[1].trim()) : null;
}

export function detectSocialPlatform(
  url: string,
): "linkedin" | "instagram" | null {
  try {
    const host = new URL(url).hostname.toLowerCase();
    if (host.includes("linkedin.com")) return "linkedin";
    if (host.includes("instagram.com")) return "instagram";
  } catch {}
  return null;
}

/** Strip platform-specific noise from a social media og:title. */
export function cleanSocialTitle(
  title: string | null,
  url: string,
): string | null {
  if (!title) return title;
  const platform = detectSocialPlatform(url);
  if (platform === "linkedin") {
    // "John Doe - VP Eng | LinkedIn" → "John Doe"  (space-dash-space = job title separator)
    // "John Doe | LinkedIn" → "John Doe"
    // Hyphenated names ("Mary-Jane") use no spaces, so \s+[-–]\s+ is safe to strip
    return (
      title
        .replace(/\s+[-–]\s+.*$/i, "")
        .replace(/\s*\|.*$/i, "")
        .trim() || title
    );
  }
  if (platform === "instagram") {
    // "natgeo (@natgeo) • Instagram photos and videos" → "natgeo"
    // "@natgeo • Instagram" → "natgeo"
    return (
      title
        .replace(/\s*\(@[^)]+\).*$/i, "")
        .replace(/\s*•\s*Instagram.*$/i, "")
        .replace(/^@/, "")
        .trim() || title
    );
  }
  return title;
}

interface XhrResult {
  text: string;
  responseUrl: string;
}

/**
 * Fetch HTML using XMLHttpRequest instead of the global fetch polyfill.
 *
 * React Native's fetch polyfill calls `new Response(body, { status: 0 })` when
 * a server drops the TCP connection (e.g. LinkedIn on blocked IPs). The Response
 * constructor rejects status 0 with a RangeError thrown synchronously inside the
 * XHR onload callback — bypassing try/catch and crashing the Bridgeless runtime.
 * Using XHR directly lets us check xhr.status before constructing any Response,
 * so connection drops become normal Promise rejections.
 *
 * Returns both the response text and the final URL after any redirects, which
 * allows callers to detect redirect-to-authwall patterns.
 */
function xhrFetch(
  url: string,
  headers: Record<string, string>,
): Promise<XhrResult> {
  // Bun / Node test environments don't have XMLHttpRequest — fall back to fetch.
  if (typeof XMLHttpRequest === "undefined") {
    return fetch(url, { headers }).then((r) => {
      if (!r.ok) throw new Error(`HTTP ${r.status}: Failed to fetch ${url}`);
      return r.text().then((text) => ({ text, responseUrl: r.url || url }));
    });
  }

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("GET", url);
    Object.entries(headers).forEach(([k, v]) => xhr.setRequestHeader(k, v));
    xhr.timeout = 10000;
    xhr.onload = () => {
      if (xhr.status === 0 || xhr.status < 200 || xhr.status >= 300) {
        reject(new Error(`HTTP ${xhr.status}: Failed to fetch ${url}`));
      } else {
        resolve({
          text: xhr.responseText,
          responseUrl: xhr.responseURL || url,
        });
      }
    };
    xhr.onerror = () => reject(new Error(`Network request failed for ${url}`));
    xhr.ontimeout = () => reject(new Error(`Request timed out for ${url}`));
    xhr.send();
  });
}

/** Minimal HTML entity decoding for common cases in OG tags. */
function decodeHTMLEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) =>
      String.fromCodePoint(parseInt(hex, 16)),
    )
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(Number(dec)));
}

export async function fetchMetadata(
  url: string,
  userAgent?: string,
): Promise<MetadataResult> {
  const platform = detectSocialPlatform(url);
  let result: XhrResult;
  try {
    result = await xhrFetch(url, {
      "User-Agent": userAgent ?? UA_FALLBACK,
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.5",
    });
  } catch (e) {
    // LinkedIn returns HTTP 999 for bot-blocked requests, or times out when throttling
    if (
      platform === "linkedin" &&
      e instanceof Error &&
      (e.message.includes("HTTP 999") || e.message.includes("timed out"))
    ) {
      throw new ProfileAuthRequiredError("LinkedIn");
    }
    throw e;
  }

  // LinkedIn redirects unauthenticated requests to /authwall or /login.
  // On Android, xhr.responseURL may not capture the redirect destination,
  // so we also inspect the HTML body for authwall markers.
  if (platform === "linkedin") {
    const finalUrl = result.responseUrl.toLowerCase();
    const bodyLower = result.text.toLowerCase();
    if (
      finalUrl.includes("/authwall") ||
      finalUrl.includes("/login") ||
      bodyLower.includes("/authwall") ||
      bodyLower.includes("uas/login") ||
      bodyLower.includes("session_redirect")
    ) {
      throw new ProfileAuthRequiredError("LinkedIn");
    }
  }

  // Instagram serves logged-out clients a login interstitial (redirect to
  // /accounts/login/) whose og:title is "Login • Instagram", not the profile
  // name. Detect it so the caller falls back to the authenticated capture flow
  // instead of creating a contact named "Login".
  if (platform === "instagram") {
    const finalUrl = result.responseUrl.toLowerCase();
    const bodyLower = result.text.toLowerCase();
    if (
      finalUrl.includes("/accounts/login") ||
      bodyLower.includes("/accounts/login/")
    ) {
      throw new ProfileAuthRequiredError("Instagram");
    }
  }

  const { text: html } = result;

  let image = parseMetaTag(html, "og:image");
  // Resolve relative image URLs
  if (image && !image.startsWith("http")) {
    try {
      const base = new URL(url);
      image = new URL(image, base.origin).toString();
    } catch {
      image = null;
    }
  }

  const rawTitle = parseMetaTag(html, "og:title") ?? parseTitle(html);
  return {
    title: cleanSocialTitle(rawTitle, url),
    image,
    description: parseMetaTag(html, "og:description"),
    url,
  };
}

export function isUrl(text: string): boolean {
  return /^https?:\/\/.+/i.test(text.trim());
}

/** Extract the first URL from arbitrary text (e.g. "Check this: https://example.com via Twitter"). */
export function extractUrlFromText(text: string): string | null {
  const match = text.match(/https?:\/\/[^\s]+/i);
  return match ? match[0] : null;
}
