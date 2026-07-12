import type { ComponentProps } from "react";
import type { Ionicons } from "@expo/vector-icons";
import type { CreateContactBodyLinksItemType } from "@orbital/client";

// Derived from the generated API client so the platform list has a single
// source of truth (the backend's SOCIAL_LINK_TYPES enum).
export type SocialLinkType = CreateContactBodyLinksItemType;

type IoniconName = ComponentProps<typeof Ionicons>["name"];

export interface SocialLinkMeta {
  label: string;
  icon: IoniconName;
  color: string;
  getUrl: (value: string) => string;
  placeholder: string;
}

const isFullUrl = (v: string) => /^https?:\/\//i.test(v);

// Values are usually bare handles, but users can paste full profile URLs
// into the editor — pass those through instead of nesting them in a path.
const profileUrl = (build: (v: string) => string) => (v: string) =>
  isFullUrl(v) ? v : build(v);

export const SOCIAL_LINK_META = {
  linkedin: {
    label: "LinkedIn",
    icon: "logo-linkedin",
    color: "#0A66C2",
    getUrl: profileUrl((v) => `https://linkedin.com/in/${v}`),
    placeholder: "handle",
  },
  twitter: {
    label: "Twitter/X",
    icon: "logo-twitter",
    color: "#1DA1F2",
    getUrl: profileUrl((v) => `https://x.com/${v}`),
    placeholder: "handle",
  },
  instagram: {
    label: "Instagram",
    icon: "logo-instagram",
    color: "#E1306C",
    getUrl: profileUrl((v) => `https://instagram.com/${v}`),
    placeholder: "handle",
  },
  facebook: {
    label: "Facebook",
    icon: "logo-facebook",
    color: "#1877F2",
    getUrl: profileUrl((v) => `https://facebook.com/${v}`),
    placeholder: "handle",
  },
  github: {
    label: "GitHub",
    icon: "logo-github",
    color: "#333333",
    getUrl: profileUrl((v) => `https://github.com/${v}`),
    placeholder: "handle",
  },
  youtube: {
    label: "YouTube",
    icon: "logo-youtube",
    color: "#FF0000",
    getUrl: profileUrl((v) =>
      v.includes("/")
        ? `https://youtube.com/${v}`
        : `https://youtube.com/@${v.replace(/^@/, "")}`,
    ),
    placeholder: "handle",
  },
  tiktok: {
    label: "TikTok",
    icon: "logo-tiktok",
    color: "#010101",
    getUrl: profileUrl((v) => `https://tiktok.com/@${v.replace(/^@/, "")}`),
    placeholder: "@handle",
  },
  website: {
    label: "Website",
    icon: "link-outline",
    color: "#64748B",
    getUrl: (v) => v,
    placeholder: "https://...",
  },
  other: {
    label: "Other",
    icon: "link-outline",
    color: "#64748B",
    getUrl: (v) => v,
    placeholder: "URL or handle",
  },
} satisfies Record<SocialLinkType, SocialLinkMeta>;

export const SOCIAL_LINK_TYPES = Object.keys(
  SOCIAL_LINK_META,
) as SocialLinkType[];

// Resolve metadata for a link type, falling back to "other" for any value the
// backend might send that isn't a known platform (e.g. a future enum addition).
export const getSocialLinkMeta = (type: string): SocialLinkMeta =>
  SOCIAL_LINK_META[type as SocialLinkType] ?? SOCIAL_LINK_META.other;

interface PlatformDetector {
  hosts: string[];
  pattern: RegExp;
  type: SocialLinkType;
  excluded?: string[];
}

const DETECTORS: PlatformDetector[] = [
  { hosts: ["linkedin.com"], pattern: /^\/in\/([^/]+)/, type: "linkedin" },
  {
    hosts: ["twitter.com", "x.com"],
    pattern: /^\/([^/]+)/,
    type: "twitter",
    excluded: ["home", "search", "explore", "i"],
  },
  {
    hosts: ["instagram.com"],
    pattern: /^\/([^/]+)/,
    type: "instagram",
    excluded: ["p", "reel", "reels", "stories", "tv", "share", "explore"],
  },
  {
    hosts: ["github.com"],
    pattern: /^\/([^/]+)/,
    type: "github",
    excluded: ["orgs", "features", "topics", "marketplace", "sponsors"],
  },
  {
    hosts: ["facebook.com", "fb.com"],
    pattern: /^\/([^/]+)/,
    type: "facebook",
    excluded: ["groups", "events", "pages", "profile.php"],
  },
  {
    hosts: ["youtube.com"],
    pattern: /^\/@([^/]+)|^\/((?:channel|c|user)\/[^/]+)/,
    type: "youtube",
  },
  { hosts: ["tiktok.com"], pattern: /^\/@([^/]+)/, type: "tiktok" },
];

/**
 * Detect social platform and extract the handle/value from a profile URL.
 * Falls back to { type: 'website', value: url } for unrecognized URLs.
 * Returns null if the input is not a valid URL.
 */
export function detectChannelFromUrl(
  url: string,
): { type: SocialLinkType; value: string } | null {
  const trimmed = url.trim();
  // Accept schemeless input like "linkedin.com/in/x" (common from share
  // sheets and screenshot extraction) by prefixing a scheme before parsing.
  const looksLikeHost = /^[\w-]+(\.[\w-]+)+([/:?#]|$)/.test(trimmed);
  const normalized =
    /^https?:\/\//i.test(trimmed) || !looksLikeHost
      ? trimmed
      : `https://${trimmed}`;
  try {
    const u = new URL(normalized);
    const host = u.hostname.replace(/^(www|m|mobile)\./, "");

    for (const { hosts, pattern, type, excluded } of DETECTORS) {
      if (!hosts.includes(host)) continue;
      const m = u.pathname.match(pattern);
      if (!m) continue;
      const value = m.slice(1).find(Boolean);
      if (value && !excluded?.includes(value.toLowerCase())) {
        return { type, value };
      }
    }

    return { type: "website", value: normalized };
  } catch {
    return null;
  }
}
