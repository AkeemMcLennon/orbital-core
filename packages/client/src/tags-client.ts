import { customFetch } from "./custom-fetch";
import type { getContactsResponse } from "./generated/client";

export const getContactsByTagId = async (
  params: { tagId: string; limit?: number; offset?: number; sort?: "date" | "name" },
  options?: RequestInit,
): Promise<getContactsResponse> => {
  const p = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined) p.append(k, String(v));
  });
  return customFetch<getContactsResponse>(`/contacts?${p.toString()}`, {
    ...options,
    method: "GET",
  });
};
