import { createContact, isSuccess } from "@orbital/client";
import { uploadAvatar } from "./uploadAvatar";
import type { SocialLinkType } from "../utils/socialLinks";

export async function createContactWithAvatar(params: {
  name: string;
  email?: string;
  notes?: string;
  avatarUrl?: string;
  avatarMimeType?: string;
  links?: Array<{ type: SocialLinkType; value: string }>;
}): Promise<{ id: string; avatarUploadFailed?: true }> {
  const isLocal = !!params.avatarUrl && !params.avatarUrl.startsWith("http");

  const result = await createContact({
    name: params.name,
    email: params.email,
    notes: params.notes,
    avatarUrl: isLocal ? undefined : params.avatarUrl,
    links: params.links,
  });
  if (!isSuccess(result)) throw new Error("Failed to create contact");

  if (isLocal && params.avatarUrl) {
    try {
      await uploadAvatar(
        result.data.id,
        params.avatarUrl,
        params.avatarMimeType ?? "image/jpeg",
      );
    } catch (err) {
      console.error("Avatar upload failed:", err);
      return { ...result.data, avatarUploadFailed: true };
    }
  }

  return result.data;
}
