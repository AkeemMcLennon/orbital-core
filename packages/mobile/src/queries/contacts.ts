import { useEffect } from "react";
import {
  useQuery,
  useQueryClient,
  useInfiniteQuery,
  type QueryClient,
} from "@tanstack/react-query";
import { getContacts, getContactById, getSuccessData } from "@orbital/client";

const PAGE_SIZE = 100;

type ContactsListData = ReturnType<
  typeof getSuccessData<Awaited<ReturnType<typeof getContacts>>>
>;

export const contactKeys = {
  all: ["contacts"] as const,
  allPages: ["contacts", "all-pages"] as const,
  detail: (id: string) => ["contacts", id] as const,
};

type CachedContact = { id: string; avatarUrl?: string | null };

/**
 * Structurally patch `avatarUrl` for one contact inside a cached query value.
 * Handles the three shapes that sit in the cache (queries store the RAW client
 * response; `select` unwraps per-hook): a response envelope holding a paginated
 * list (`data.items`), an infinite-query result (`pages` of envelopes), and an
 * envelope holding a single contact.
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

  // Infinite query: { pages: [envelope, ...], pageParams }
  if ("pages" in value && Array.isArray(value.pages)) {
    let changed = false;
    const pages = value.pages.map((page) => {
      const patched = patchInCachedValue(page, contactId, avatarUrl);
      if (patched !== undefined) changed = true;
      return patched ?? page;
    });
    return changed ? { ...value, pages } : undefined;
  }

  // Response envelope: { status, data, headers }
  if ("data" in value) {
    const d = value.data;
    if (!d || typeof d !== "object") return undefined;

    // Paginated list: { items: [...], pagination }
    if ("items" in d && Array.isArray(d.items)) {
      const items = d.items as CachedContact[];
      const idx = items.findIndex((c) => c?.id === contactId && !c.avatarUrl);
      if (idx === -1) return undefined;
      const patchedItems = [...items];
      patchedItems[idx] = { ...patchedItems[idx], avatarUrl };
      return { ...value, data: { ...d, items: patchedItems } };
    }

    // Single contact
    const c = d as CachedContact;
    if (c.id === contactId && !c.avatarUrl) {
      return { ...value, data: { ...c, avatarUrl } };
    }
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

export function useContactsList(params?: Parameters<typeof getContacts>[0]) {
  return useQuery({
    queryKey: contactKeys.all,
    queryFn: () => getContacts(params),
    select: getSuccessData,
    staleTime: 5 * 60 * 1000,
    throwOnError: false,
  });
}

export function useAllContactsList() {
  const query = useInfiniteQuery({
    queryKey: contactKeys.allPages,
    queryFn: ({ pageParam }) =>
      getContacts({ limit: PAGE_SIZE, offset: pageParam, sort: "name" }),
    getNextPageParam: (lastPage, pages) => {
      const data = getSuccessData(lastPage);
      const loaded = pages.length * PAGE_SIZE;
      return loaded < (data?.pagination.total ?? 0) ? loaded : undefined;
    },
    initialPageParam: 0,
    select: (data) => data.pages.flatMap((p) => getSuccessData(p)?.items ?? []),
    staleTime: 5 * 60 * 1000,
    throwOnError: false,
  });

  useEffect(() => {
    if (query.hasNextPage && !query.isFetchingNextPage) {
      query.fetchNextPage();
    }
  }, [query.hasNextPage, query.isFetchingNextPage, query.fetchNextPage, query]);

  return query;
}

export function useContactsByTag(tagId: string) {
  return useQuery({
    queryKey: ["contacts", "by-tag", tagId],
    queryFn: () => getContacts({ tagId, limit: 100, offset: 0, sort: "name" }),
    select: (data) => getSuccessData(data)?.items ?? [],
    staleTime: 5 * 60 * 1000,
    enabled: !!tagId,
    throwOnError: false,
  });
}

export function useContact(id: string) {
  const queryClient = useQueryClient();

  return useQuery({
    queryKey: contactKeys.detail(id),
    queryFn: () => getContactById(id),
    initialData: () => {
      const listData = queryClient.getQueryData<ContactsListData>(
        contactKeys.all,
      );
      const match = listData?.items?.find((c) => c.id === id);
      if (!match) return undefined;
      return { status: 200 as const, data: match, headers: new Headers() };
    },
    select: (data) => getSuccessData(data),
    staleTime: 5 * 60 * 1000,
    throwOnError: false,
  });
}
