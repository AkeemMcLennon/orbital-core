import vCard from "vcf";
import { File, Paths } from "expo-file-system";
import { toFileUri } from "./fileUri";
import { canonicalImageMimeType, imageMimeToExt } from "../lib/imageMime";

/**
 * A vCard mapped onto the fields Orbital's contact flows understand.
 *
 * A PHOTO is exposed as either `photoUrl` (an http(s) reference) or
 * `photoBase64` (+ `photoMimeType`) for an embedded image. Embedded images must
 * be written to a file before use — `fetch('data:...')` and `<Image>` with a
 * `data:` URI both fail under Hermes — so call `materializeAvatar` to get a
 * usable `file://` URI for the existing avatar pipeline.
 */
export type ParsedVCard = {
  name: string;
  email?: string;
  phone?: string;
  company?: string;
  jobTitle?: string;
  notes?: string;
  birthday?: string;
  urls?: string[];
  extras?: VCardExtra[];
  photoUrl?: string;
  photoBase64?: string;
  photoMimeType?: string;
};

/** A vCard value Orbital has no column for, labelled for the notes field. */
export type VCardExtra = { label: string; value: string };

/** React Query cache key for a parsed vCard, so the share handler can parse
 * once and the destination screen reuses the result instead of re-reading. */
export function vcardCacheKey(uri: string) {
  return ["vcard", uri] as const;
}

/** Whether a shared file looks like a vCard, by MIME type or `.vcf` name. */
export function isVCardFile(
  file:
    | { mimeType?: string; path?: string; fileName?: string }
    | null
    | undefined,
): boolean {
  if (!file) return false;
  const mime = file.mimeType?.toLowerCase();
  return (
    !!mime?.includes("vcard") || // text/vcard, text/x-vcard, application/vcard
    mime === "text/directory" ||
    !!file.path?.toLowerCase().endsWith(".vcf") ||
    !!file.fileName?.toLowerCase().endsWith(".vcf")
  );
}

/** Read + parse a shared vCard file into mapped contacts. expo-share-intent
 * hands back a schemeless path, so normalize it before reading. */
export async function readVCardCards(uri: string): Promise<ParsedVCard[]> {
  return parseVCards(await new File(toFileUri(uri)).text());
}

/** Parse a vCard string (one or many cards) into mapped contacts. */
export function parseVCards(text: string): ParsedVCard[] {
  // vCard.parse only splits on CRLF and throws if anything (BOM, blank line)
  // precedes "BEGIN:VCARD". Normalize line endings to CRLF and strip the BOM so
  // LF-only or CR-only files (RFC requires CRLF, but exports vary) still parse.
  const cleaned = text
    .replace(/^﻿/, "")
    .replace(/\r\n|\r|\n/g, "\r\n")
    .trim();
  let cards: vCard[];
  try {
    cards = vCard.parse(cleaned);
  } catch {
    return [];
  }
  return cards.filter(hasContent).map(mapCard);
}

// --- helpers --------------------------------------------------------------

/** vCard.parse() can yield empty cards (e.g. the leading split chunk); keep
 * only cards carrying an identifying field. */
function hasContent(card: vCard): boolean {
  return !!(
    card.get("fn") ||
    card.get("n") ||
    card.get("email") ||
    card.get("tel")
  );
}

function firstProp(card: vCard, key: string): vCard.Property | undefined {
  const prop = card.get(key);
  if (prop == null) return undefined;
  return Array.isArray(prop) ? prop[0] : prop;
}

function firstValue(card: vCard, key: string): string | undefined {
  const v = firstProp(card, key)?.valueOf()?.trim();
  return v ? v : undefined;
}

function allProps(card: vCard, key: string): vCard.Property[] {
  const prop = card.get(key);
  if (prop == null) return [];
  return Array.isArray(prop) ? prop : [prop];
}

function allValues(card: vCard, key: string): string[] {
  return allProps(card, key)
    .map((p) => p.valueOf().trim())
    .filter(Boolean);
}

/** A property's parameters, e.g. `{ type: ["work", "voice"], pref: "1" }`.
 * The parser lowercases and comma-splits TYPE, so `type` is string|string[]. */
function params(prop: vCard.Property): Record<string, string | string[]> {
  return prop.toJSON()[1] as Record<string, string | string[]>;
}

// TYPE values that describe the transport rather than which number this is.
// Skipped when labelling, so `TYPE=WORK,VOICE` reads "(work)", not "(voice)".
const NOISE_TYPES = new Set(["voice", "pref", "internet", "text", "uri"]);

/** Label a property with its first meaningful TYPE, e.g. `Phone (work)`. */
function labelled(base: string, prop: vCard.Property): string {
  const type = params(prop).type;
  const list = Array.isArray(type) ? type : type ? [type] : [];
  const meaningful = list.find(
    (t) => !NOISE_TYPES.has(t) && !t.startsWith("x-"),
  );
  return meaningful ? `${base} (${meaningful})` : base;
}

/** A TEL/EMAIL property paired with its cleaned value. vCard 4.0 writes these
 * as URIs (`TEL;VALUE=uri:tel:+1-555-0100`), so the scheme is dropped before
 * the value reaches a phone/email column. */
type Channel = { prop: vCard.Property; value: string };

/** All non-empty TEL/EMAIL properties for a key, values cleaned once. */
function channels(card: vCard, key: string): Channel[] {
  return allProps(card, key)
    .map((prop) => ({
      prop,
      value: unescape(prop.valueOf().trim()).replace(/^(?:tel|mailto):/i, ""),
    }))
    .filter((c) => c.value);
}

/**
 * Split a structured vCard value on its unescaped `;` delimiters, leaving
 * escape sequences intact for `unescape` to resolve afterwards.
 *
 * Needed because the parser's own pre-split (`toJSON()[3]`) treats an escaped
 * `\;` as a delimiter, so a street like `Suite 1\; Building A` arrives already
 * broken into `Suite 1\` and ` Building A`. The raw `valueOf()` still carries
 * the backslash, so splitting it ourselves is the only way to keep the
 * component whole.
 */
function splitComponents(value: string): string[] {
  const parts: string[] = [];
  let current = "";
  for (let i = 0; i < value.length; i++) {
    const ch = value[i];
    if (ch === "\\" && i + 1 < value.length) {
      current += ch + value[i + 1];
      i++; // consume the escaped character verbatim
    } else if (ch === ";") {
      parts.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  parts.push(current);
  return parts;
}

/** ADR is `;`-delimited: pobox;ext;street;locality;region;postal;country. */
function formatAddress(prop: vCard.Property): string {
  return splitComponents(prop.valueOf().trim())
    .map((p) => unescape(p.trim()))
    .filter(Boolean)
    .join(", ");
}

/**
 * The values a card carries that Orbital has no column for: every TEL/EMAIL
 * past the first, plus addresses, nicknames and roles. The import funnel
 * appends these to the notes.
 *
 * Extras are ordered here rather than following the card's own property order,
 * so the same card always produces the same notes text. Vendor `X-*` properties
 * and IMPP are dropped. Additional phones/emails are identified by position
 * (the primary is index 0) — never by comparing values, since 4.0's `tel:`
 * prefixes and formatting differences would defeat a string match.
 */
function collectExtras(
  card: vCard,
  tels: Channel[],
  emails: Channel[],
): VCardExtra[] | undefined {
  const extras: VCardExtra[] = [
    ...tels.slice(1).map((c) => ({
      label: labelled("Phone", c.prop),
      value: c.value,
    })),
    ...emails.slice(1).map((c) => ({
      label: labelled("Email", c.prop),
      value: c.value,
    })),
    ...allProps(card, "adr")
      .map((p) => ({ label: labelled("Address", p), value: formatAddress(p) }))
      .filter((e) => e.value),
    ...allValues(card, "nickname").map((v) => ({
      label: "Nickname",
      value: unescape(v),
    })),
    ...allValues(card, "role").map((v) => ({
      label: "Role",
      value: unescape(v),
    })),
  ];
  return extras.length ? extras : undefined;
}

/** vCard text values escape `\n`, `\,`, `\;` and `\\`. */
function unescape(value: string): string {
  return value.replace(/\\([\\,;nN])/g, (_, ch) =>
    ch === "n" || ch === "N" ? "\n" : ch,
  );
}

function mapCard(card: vCard): ParsedVCard {
  const photo = mapPhoto(card);
  // Read TEL/EMAIL as lists: the first of each gets a column, the rest become
  // extras. Empty properties are dropped first so they can't claim the primary
  // slot and push a real number into the notes.
  const tels = channels(card, "tel");
  const emails = channels(card, "email");
  return {
    name: mapName(card),
    email: emails[0]?.value,
    phone: tels[0]?.value,
    company: firstValue(card, "org")?.split(";")[0]?.trim() || undefined,
    jobTitle: firstValue(card, "title"),
    notes: (() => {
      const note = firstValue(card, "note");
      return note ? unescape(note) : undefined;
    })(),
    birthday: normalizeBirthday(firstValue(card, "bday")),
    urls: allValues(card, "url"),
    extras: collectExtras(card, tels, emails),
    ...photo,
  };
}

function mapName(card: vCard): string {
  const fn = firstValue(card, "fn");
  if (fn) return fn;
  // Structured N: Family;Given;Additional;Prefix;Suffix
  const n = firstValue(card, "n");
  if (n) {
    const [family, given, additional, prefix, suffix] = n
      .split(";")
      .map((p) => p.trim());
    const composed = [prefix, given, additional, family, suffix]
      .filter(Boolean)
      .join(" ")
      .trim();
    if (composed) return composed;
  }
  return "Unknown";
}

/** BDAY can be `1985-03-15`, `19850315`, `--0315` (no year), or carry a time
 * suffix. Normalize to `YYYY-MM-DD` or `MM-DD`; return undefined if unparseable. */
function normalizeBirthday(bday?: string): string | undefined {
  if (!bday) return undefined;
  const v = bday.trim();
  let m = v.match(/^(\d{4})-?(\d{2})-?(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = v.match(/^--?(\d{2})-?(\d{2})/); // year omitted
  if (m) return `${m[1]}-${m[2]}`;
  return undefined;
}

function typeToMime(type?: string): string {
  switch ((type ?? "").toLowerCase()) {
    case "png":
      return "image/png";
    case "gif":
      return "image/gif";
    case "webp":
      return "image/webp";
    default:
      return "image/jpeg";
  }
}

/** Decode the PHOTO property into a URL or raw base64, handling v4 `data:`
 * URIs, http URLs, and v2.1/v3.0 inline base64. */
function mapPhoto(card: vCard): {
  photoUrl?: string;
  photoBase64?: string;
  photoMimeType?: string;
} {
  const prop = firstProp(card, "photo");
  const raw = prop?.valueOf()?.trim();
  if (!prop || !raw) return {};

  // v4.0: value is a data: URI — split out the mime and base64 payload.
  if (raw.startsWith("data:")) {
    const match = raw.match(/^data:([^;,]+)?(?:;base64)?,(.*)$/s);
    if (match) {
      return {
        photoBase64: match[2].replace(/\s+/g, ""),
        photoMimeType: match[1] || "image/jpeg",
      };
    }
    return {};
  }

  // PHOTO given as a URL reference.
  if (/^https?:\/\//i.test(raw)) {
    return { photoUrl: raw };
  }

  // v2.1/v3.0: raw base64 with a TYPE param (e.g. JPEG).
  const params = prop.toJSON()[1] as Record<string, string | string[]>;
  const type = Array.isArray(params.type) ? params.type[0] : params.type;
  return {
    photoBase64: raw.replace(/\s+/g, ""),
    photoMimeType: typeToMime(type),
  };
}

let avatarSeq = 0;

/**
 * Resolve a parsed card's photo to a usable avatar URI for the create/upload
 * pipeline. Remote photos pass through as their URL; embedded base64 photos are
 * written to a cache file and returned as a `file://` URI (Hermes can't fetch or
 * render `data:` URIs, but handles `file://` like any ImagePicker result).
 * Photos whose type the avatar store can't accept (e.g. HEIC) are skipped.
 */
export async function materializeAvatar(
  card: ParsedVCard,
): Promise<{ uri: string; mimeType: string } | undefined> {
  if (card.photoUrl) return { uri: card.photoUrl, mimeType: "image/jpeg" };
  if (!card.photoBase64) return undefined;
  const mime = canonicalImageMimeType(card.photoMimeType ?? "image/jpeg");
  if (!mime) return undefined; // unsupported type (e.g. HEIC) — skip the photo
  try {
    const file = new File(
      Paths.cache,
      `vcard-avatar-${avatarSeq++}.${imageMimeToExt(mime)}`,
    );
    file.create({ overwrite: true });
    file.write(card.photoBase64, { encoding: "base64" });
    return { uri: file.uri, mimeType: mime };
  } catch (err) {
    console.error("Failed to write vCard avatar:", err);
    return undefined;
  }
}
