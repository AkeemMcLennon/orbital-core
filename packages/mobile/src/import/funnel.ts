import {
  detectChannelFromUrl,
  type SocialLinkType,
} from "../utils/socialLinks";
import { type ImportedContact } from "./types";

/** The result of folding an ImportedContact into the add-contact form's state. */
export type PrefillPlan = {
  name: string;
  /** UI prefill state uses null for "absent". */
  email: string | null;
  /** Local URI or remote URL for the preview <Image> and the create path. */
  avatarUrl: string | null;
  /** Set only for local avatars (drives the post-create uploadAvatar). */
  avatarMimeType: string | null;
  /** Fully folded notes (extras + source notes + birthday). */
  notes: string;
  detectedLink: { type: SocialLinkType; value: string } | null;
};

/**
 * Fold an ImportedContact into the single-add form's prefill, in one pure pass.
 * Replaces the per-source logic that used to live in `applyExtractedContact`
 * plus the vCard-specific extras block.
 *
 * Folding order matches prior behavior: Phone/Company/Title lines, then the
 * source's freeform notes, then Birthday. Link detection prefers an
 * already-resolved link, else the first `rawLink` that resolves — bare paths
 * like `/in/foo` get a `linkedin.com` host first (screenshot extraction).
 */
export function planPrefill(c: ImportedContact): PrefillPlan {
  const folded = [
    c.phone && `Phone: ${c.phone}`,
    c.company && `Company: ${c.company}`,
    c.jobTitle && `Title: ${c.jobTitle}`,
    c.notes,
    c.birthday && `Birthday: ${c.birthday}`,
  ].filter(Boolean) as string[];

  let detectedLink = c.links?.[0] ?? null;
  if (!detectedLink && c.rawLinks) {
    for (const raw of c.rawLinks) {
      const normalized = raw.startsWith("/") ? `linkedin.com${raw}` : raw;
      const channel = detectChannelFromUrl(normalized);
      if (channel) {
        detectedLink = channel;
        break;
      }
    }
  }

  const local = c.avatar?.kind === "local" ? c.avatar : null;
  return {
    name: c.name,
    email: c.email ?? null,
    avatarUrl:
      (c.avatar?.kind === "remote" ? c.avatar.url : c.avatar?.uri) ?? null,
    avatarMimeType: local ? local.mimeType : null,
    notes: folded.join("\n"),
    detectedLink,
  };
}
