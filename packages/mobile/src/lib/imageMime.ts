/** Image MIME types Orbital's avatar storage (Cloudflare R2) accepts. */
export const ALLOWED_IMAGE_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
] as const;

export type AllowedImageMimeType = (typeof ALLOWED_IMAGE_MIME_TYPES)[number];

/**
 * Normalize a MIME type to a supported avatar type, or return null if it isn't
 * one we can upload (e.g. image/heic, image/bmp). Handles the common
 * "image/jpg" variant iOS sometimes reports.
 */
export function canonicalImageMimeType(
  mimeType: string,
): AllowedImageMimeType | null {
  const lower = mimeType.toLowerCase();
  const normalized = lower === "image/jpg" ? "image/jpeg" : lower;
  return (ALLOWED_IMAGE_MIME_TYPES as readonly string[]).includes(normalized)
    ? (normalized as AllowedImageMimeType)
    : null;
}

/** File extension for a supported image MIME type. */
export function imageMimeToExt(mime: AllowedImageMimeType): string {
  switch (mime) {
    case "image/png":
      return "png";
    case "image/gif":
      return "gif";
    case "image/webp":
      return "webp";
    default:
      return "jpg";
  }
}
