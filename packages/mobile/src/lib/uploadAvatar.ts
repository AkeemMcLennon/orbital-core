import { getAvatarUploadUrl, updateContact } from "@orbital/client";
import type { QueryClient } from "@tanstack/react-query";
import { canonicalImageMimeType } from "./imageMime";
import { contactKeys, keepContactAvatarPatched } from "../queries/contacts";

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

/**
 * Fire-and-forget avatar upload that swaps the contact's avatarUrl between the
 * local and remote version at the data layer: the contact's cached avatarUrl is
 * optimistically set to the local URI (and kept set across refetches) while the
 * upload runs, then the final invalidation pulls the real remote URL in — or
 * restores the server truth (null → initials) on failure. Components stay dumb;
 * they just render `contact.avatarUrl` from the cache.
 *
 * Rejections propagate, so callers attach `.catch` for failure alerts.
 */
export function backgroundUploadAvatar(
  queryClient: QueryClient,
  contactId: string,
  localUri: string,
  mimeType: string,
): Promise<void> {
  const stopPatching = keepContactAvatarPatched(
    queryClient,
    contactId,
    localUri,
  );
  return uploadAvatar(contactId, localUri, mimeType).finally(() => {
    stopPatching();
    queryClient.invalidateQueries({ queryKey: contactKeys.all });
  });
}
