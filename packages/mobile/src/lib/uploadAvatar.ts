import { getAvatarUploadUrl, updateContact } from "@orbital/client";

const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
] as const;

type AllowedMimeType = (typeof ALLOWED_MIME_TYPES)[number];

function normalizeImageMimeType(mimeType: string): AllowedMimeType {
  // iOS sometimes returns "image/jpg" instead of the standard "image/jpeg"
  const normalized = mimeType === "image/jpg" ? "image/jpeg" : mimeType;
  if (!(ALLOWED_MIME_TYPES as readonly string[]).includes(normalized)) {
    throw new Error(`Unsupported image type: ${mimeType}`);
  }
  return normalized as AllowedMimeType;
}

export async function uploadAvatar(
  contactId: string,
  localUri: string,
  mimeType: string,
): Promise<void> {
  const contentType = normalizeImageMimeType(mimeType);
  const blob = await (await fetch(localUri)).blob();

  const urlRes = await getAvatarUploadUrl(contactId, {
    contentType,
    contentLength: blob.size,
  });
  if (urlRes.status !== 200) throw new Error("Failed to get upload URL");
  const { uploadUrl, publicUrl } = urlRes.data;

  const putRes = await fetch(uploadUrl, {
    method: "PUT",
    headers: {
      "Content-Type": contentType,
      "Content-Length": String(blob.size),
    },
    body: blob,
  });
  if (!putRes.ok) throw new Error(`Upload failed: ${putRes.status}`);

  await updateContact(contactId, { avatarUrl: publicUrl });
}
