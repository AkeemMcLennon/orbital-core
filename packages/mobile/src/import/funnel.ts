import {
  detectChannelFromUrl,
  type SocialLinkType,
} from "../utils/socialLinks";
import { type ParsedVCard } from "../utils/vcard";
import { type ImportedContact } from "./types";

/** What the API accepts for a birthday: "YYYY-MM-DD" or "MM-DD" (mirrors the
 * backend's zod regex). Screens use it to hold back values the server would
 * reject rather than failing a whole create/import. */
export const BIRTHDAY_RE = /^(\d{4}-\d{2}-\d{2}|\d{2}-\d{2})$/;

/**
 * Map a parsed vCard (plus its materialized avatar, if any) onto the shared
 * import shape. The single mapping for both the single-add and bulk import
 * screens — a field added to ParsedVCard gets threaded through here once.
 */
export function toImportedContact(
  card: ParsedVCard,
  avatar?: { uri: string; mimeType: string },
): ImportedContact {
  return {
    name: card.name,
    email: card.email,
    phone: card.phone,
    company: card.company,
    jobTitle: card.jobTitle,
    birthday: card.birthday,
    notes: card.notes,
    extras: card.extras,
    rawLinks: card.urls,
    avatar: avatar
      ? avatar.uri.startsWith("http")
        ? { kind: "remote", url: avatar.uri }
        : { kind: "local", uri: avatar.uri, mimeType: avatar.mimeType }
      : undefined,
  };
}

/** The result of mapping an ImportedContact onto the add-contact form's state. */
export type PrefillPlan = {
  name: string;
  /** UI prefill state uses null for "absent". */
  email: string | null;
  /** Fields with their own column. The form reveals an input for each one the
   * source actually supplied, and sends it as a column — never as notes text. */
  phone: string | null;
  company: string | null;
  jobTitle: string | null;
  birthday: string | null;
  /** Local URI or remote URL for the preview <Image> and the create path. */
  avatarUrl: string | null;
  /** Set only for local avatars (drives the post-create uploadAvatar). */
  avatarMimeType: string | null;
  /** Source notes plus anything with no column of its own — see composeNotes. */
  notes: string;
  detectedLink: { type: SocialLinkType; value: string } | null;
};

/**
 * The notes text for an imported contact: its labelled extras, then the
 * source's own freeform notes.
 *
 * Only values with nowhere else to go land here. Phone, company, job title and
 * birthday used to be folded in as `Phone: …` lines, which left the columns
 * empty — the backend then had to LLM-scrape them back out, and never
 * recovered the phone at all.
 */
export function composeNotes(c: ImportedContact): string {
  return [...(c.extras ?? []).map((e) => `${e.label}: ${e.value}`), c.notes]
    .filter(Boolean)
    .join("\n");
}

/**
 * The single social link to attach to an imported contact. Prefers an
 * already-resolved link, else the first `rawLink` that resolves — bare paths
 * like `/in/foo` get a `linkedin.com` host first (screenshot extraction).
 */
export function resolveLink(
  c: ImportedContact,
): { type: SocialLinkType; value: string } | null {
  if (c.links?.[0]) return c.links[0];
  for (const raw of c.rawLinks ?? []) {
    const normalized = raw.startsWith("/") ? `linkedin.com${raw}` : raw;
    const channel = detectChannelFromUrl(normalized);
    if (channel) return channel;
  }
  return null;
}

/**
 * Map an ImportedContact onto the single-add form's prefill, in one pure pass.
 * Every field the source supplied keeps its own identity; the form decides
 * which inputs to reveal.
 */
export function planPrefill(c: ImportedContact): PrefillPlan {
  const local = c.avatar?.kind === "local" ? c.avatar : null;
  return {
    name: c.name,
    email: c.email ?? null,
    phone: c.phone ?? null,
    company: c.company ?? null,
    jobTitle: c.jobTitle ?? null,
    birthday: c.birthday ?? null,
    avatarUrl:
      (c.avatar?.kind === "remote" ? c.avatar.url : c.avatar?.uri) ?? null,
    avatarMimeType: local ? local.mimeType : null,
    notes: composeNotes(c),
    detectedLink: resolveLink(c),
  };
}
