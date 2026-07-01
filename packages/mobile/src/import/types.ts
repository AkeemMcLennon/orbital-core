import type { SocialLinkType } from "../utils/socialLinks";

/**
 * A contact mapped from any import source (vCard, screenshot extraction,
 * device contacts, URL metadata) into Orbital's create/prefill shape.
 *
 * Intentionally *structured* (not pre-folded): the prefill funnel
 * (`planPrefill`) decides what becomes the notes field, which link to attach,
 * and how the avatar is used. Keeping fields separate lets the bulk-create path
 * pass them through as columns while the single-add path folds extras into notes.
 */
export type ImportedContact = {
  /** Always present; defaults to "Unknown" (metadata falls back to its URL). */
  name: string;
  /** Undefined when absent — never null (only the UI prefill state uses null). */
  email?: string;
  phone?: string;
  company?: string;
  jobTitle?: string;
  /** Normalized `YYYY-MM-DD` or `MM-DD` (vCard only today). */
  birthday?: string;
  /** Source-provided freeform notes (vCard NOTE, metadata description). */
  notes?: string;
  /** Already-resolved links — the funnel attaches the first one. */
  links?: { type: SocialLinkType; value: string }[];
  /** Unresolved URLs the funnel runs `detectChannelFromUrl` over (first match wins). */
  rawLinks?: string[];
  avatar?: ImportedAvatar;
};

/**
 * Avatar with the remote/local distinction made explicit, so no consumer has to
 * re-derive it with `startsWith("http")`. A remote URL goes straight into the
 * create payload; a local file://|content:// URI is uploaded after creation.
 */
export type ImportedAvatar =
  | { kind: "remote"; url: string }
  | { kind: "local"; uri: string; mimeType: string };
