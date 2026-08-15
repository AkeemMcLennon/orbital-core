import { getAvailableContacts, type Unwrapped } from "@orbital/client";
import { useAllPages } from "./use-all-pages";

type AvailableContact = NonNullable<
  Unwrapped<typeof getAvailableContacts>
>["items"][number];

export const availableContactKeys = {
  all: ["available-contacts"] as const,
};

export function useAllAvailableContactsList() {
  return useAllPages<AvailableContact>({
    queryKey: availableContactKeys.all,
    fetchPage: (page) => getAvailableContacts(page),
  });
}
