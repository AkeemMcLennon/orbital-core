import { createContact, unwrap } from "@orbital/client";
import type { QueryClient } from "@tanstack/react-query";
import { backgroundUploadAvatar } from "./uploadAvatar";
import type { SocialLinkType } from "../utils/socialLinks";

export async function createContactWithAvatar(
  queryClient: QueryClient,
  params: {
    name: string;
    email?: string;
    phone?: string;
    company?: string;
    jobTitle?: string;
    /** "YYYY-MM-DD" or "MM-DD"; the API rejects anything else. */
    birthday?: string;
    notes?: string;
    strength?: number;
    avatarUrl?: string;
    avatarMimeType?: string;
    links?: Array<{ type: SocialLinkType; value: string }>;
  },
): Promise<{ id: string; avatarUpload?: Promise<void> }> {
  const isLocal = !!params.avatarUrl && !params.avatarUrl.startsWith("http");

  // unwrap throws an ApiError carrying the status and the server's message,
  // rather than a generic "Failed to create contact".
  const contact = unwrap(
    await createContact({
      name: params.name,
      email: params.email,
      phone: params.phone,
      company: params.company,
      jobTitle: params.jobTitle,
      birthday: params.birthday,
      notes: params.notes,
      strength: params.strength,
      avatarUrl: isLocal ? undefined : params.avatarUrl,
      links: params.links,
    }),
  );

  // For a local photo, don't block on the upload: start it in the background
  // (with an optimistic cache preview) and return a promise the caller can
  // react to (alert on failure) after it has already navigated away.
  const avatarUpload =
    isLocal && params.avatarUrl
      ? backgroundUploadAvatar(
          queryClient,
          contact.id,
          params.avatarUrl,
          params.avatarMimeType ?? "image/jpeg",
        )
      : undefined;

  return { id: contact.id, avatarUpload };
}
