import { getAvatarUploadUrl, updateContact } from "@orbital/client";
import { canonicalImageMimeType } from "./imageMime";

export async function uploadAvatar(
  contactId: string,
  localUri: string,
  mimeType: string,
): Promise<void> {
  const contentType = canonicalImageMimeType(mimeType);
  if (!contentType) throw new Error(`Unsupported image type: ${mimeType}`);
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
