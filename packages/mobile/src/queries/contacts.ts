import {
  queryOptions,
  useQuery,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";
import {
  getContacts,
  getContactById,
  unwrapAsync,
  type Unwrapped,
} from "@orbital/client";
import { useAllPages } from "./use-all-pages";

/** Unwrapped `/contacts` payload — what now sits in the cache. */
type ContactsListData = Unwrapped<typeof getContacts>;
type Contact = NonNullable<ContactsListData>["items"][number];

export const contactKeys = {
  all: ["contacts"] as const,
  allPages: ["contacts", "all-pages"] as const,
  detail: (id: string) => ["contacts", id] as const,
};

type CachedContact = { id: string; avatarUrl?: string | null };

/**
 * Structurally patch `avatarUrl` for one contact inside a cached query value.
 * Handles the three shapes that sit in the cache (queries store the UNWRAPPED
 * payload): a paginated list (`items`), an infinite-query result (`pages` of
 * payloads), and a single contact.
 *
 * Only patches when the cached contact's avatar is EMPTY — a real remote URL
 * that has already landed must never be overwritten by a local URI. Returns
 * `undefined` when nothing changed, which makes `setQueriesData` bail out
 * without firing a cache event (loop protection).
 */
function patchInCachedValue(
  value: unknown,
  contactId: string,
  avatarUrl: string,
): unknown {
  if (!value || typeof value !== "object") return undefined;

  // Infinite query: { pages: [payload, ...], pageParams }
  if ("pages" in value && Array.isArray(value.pages)) {
    let changed = false;
    const pages = value.pages.map((page) => {
      const patched = patchInCachedValue(page, contactId, avatarUrl);
      if (patched !== undefined) changed = true;
      return patched ?? page;
    });
    return changed ? { ...value, pages } : undefined;
  }

  // Paginated list: { items: [...], pagination }
  if ("items" in value && Array.isArray(value.items)) {
    const items = value.items as CachedContact[];
    const idx = items.findIndex((c) => c?.id === contactId && !c.avatarUrl);
    if (idx === -1) return undefined;
    const patchedItems = [...items];
    patchedItems[idx] = { ...patchedItems[idx], avatarUrl };
    return { ...value, items: patchedItems };
  }

  // Single contact
  const contact = value as CachedContact;
  if (contact.id === contactId && !contact.avatarUrl) {
    return { ...contact, avatarUrl };
  }

  return undefined;
}

function patchCachedContactAvatar(
  queryClient: QueryClient,
  contactId: string,
  avatarUrl: string,
): void {
  // Prefix ["contacts"] matches the list, infinite, by-tag, and detail caches.
  queryClient.setQueriesData({ queryKey: contactKeys.all }, (cached: unknown) =>
    patchInCachedValue(cached, contactId, avatarUrl),
  );
}

/**
 * Keep a contact's `avatarUrl` optimistically set to a local URI across
 * refetches, for the duration of a background upload. While the upload is
 * pending the server still returns a null avatar, so any refetch (focus
 * invalidation, enrichment ticks, pull-to-refresh) would clobber a one-shot
 * cache write — instead we watch the cache and re-apply the patch whenever a
 * real fetch lands. Our own `setQueryData` writes carry `manual: true` and are
 * ignored, and the patcher bails when nothing needs changing, so this cannot
 * loop.
 *
 * Returns an unsubscribe function; call it once the upload settles, then
 * invalidate so the server truth (remote URL, or null on failure) flows in.
 */
export function keepContactAvatarPatched(
  queryClient: QueryClient,
  contactId: string,
  localUri: string,
): () => void {
  const apply = () =>
    patchCachedContactAvatar(queryClient, contactId, localUri);
  apply();
  return queryClient.getQueryCache().subscribe((event) => {
    if (
      event.type === "updated" &&
      event.action.type === "success" &&
      !event.action.manual &&
      event.query.queryKey[0] === contactKeys.all[0]
    ) {
      apply();
    }
  });
}

/**
 * Single source of truth for the contacts list query, shared by the hook and
 * the root layout's prefetch so both can't drift into different cache shapes.
 */
export function contactsListOptions(
  params?: Parameters<typeof getContacts>[0],
) {
  return queryOptions({
    queryKey: contactKeys.all,
    queryFn: () => unwrapAsync(getContacts(params)),
    staleTime: 5 * 60 * 1000,
  });
}

export function useContactsList(params?: Parameters<typeof getContacts>[0]) {
  return useQuery(contactsListOptions(params));
}

export function useAllContactsList() {
  return useAllPages<Contact>({
    queryKey: contactKeys.allPages,
    fetchPage: (page) => getContacts({ ...page, sort: "name" }),
  });
}

export function useContactsByTag(tagId: string) {
  return useQuery({
    queryKey: ["contacts", "by-tag", tagId],
    queryFn: () =>
      unwrapAsync(getContacts({ tagId, limit: 100, offset: 0, sort: "name" })),
    select: (data) => data?.items ?? [],
    staleTime: 5 * 60 * 1000,
    enabled: !!tagId,
  });
}

export function useContact(id: string) {
  const queryClient = useQueryClient();

  return useQuery({
    queryKey: contactKeys.detail(id),
    queryFn: () => unwrapAsync(getContactById(id)),
    // Seed from the already-loaded list so opening a contact is instant.
    //
    // placeholderData, NOT initialData: the list payload is partial (the list
    // route returns bare rows; only the detail route hydrates tags/links), and
    // initialData is persisted as fresh — with staleTime 5min that would pin
    // the partial row and suppress the detail fetch, hiding tags and social
    // links for up to 5 minutes. placeholderData renders instantly but is
    // never persisted, so the real fetch always runs. (Screen tests can't
    // catch a regression here: their QueryClient uses staleTime 0.)
    placeholderData: () => {
      const listData = queryClient.getQueryData<ContactsListData>(
        contactKeys.all,
      );
      return listData?.items?.find((c) => c.id === id);
    },
    staleTime: 5 * 60 * 1000,
  });
}
