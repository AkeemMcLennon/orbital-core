export interface MetadataResult {
  title: string | null;
  image: string | null;
  description: string | null;
  url: string;
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

export async function fetchMetadata(url: string, userAgent?: string): Promise<MetadataResult> {
  const response = await fetch(url, {
    headers: {
      "User-Agent": userAgent ?? UA_FALLBACK,
      Accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.5",
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: Failed to fetch ${url}`);
  }

  const html = await response.text();

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

  return {
    title: parseMetaTag(html, "og:title") ?? parseTitle(html),
    image,
    description: parseMetaTag(html, "og:description"),
    url,
  };
}

export function isUrl(text: string): boolean {
  return /^https?:\/\/.+/i.test(text.trim());
}
