import { useEffect, useRef } from "react";
import { useInfiniteQuery, type QueryKey } from "@tanstack/react-query";
import { unwrapAsync } from "@orbital/client";

const DEFAULT_PAGE_SIZE = 100;
const DEFAULT_STALE_TIME = 5 * 60 * 1000;

/** The paginated envelope every list endpoint returns. */
type Page<TItem> = {
  items: TItem[];
  pagination: { total: number; limit: number; offset: number };
};

/**
 * Load every page of a paginated endpoint into one flat array.
 *
 * Walks pages automatically until the server's `pagination.total` is covered,
 * then flattens them via `select`. Note the cache still holds the raw
 * `{ pages: [payload, ...] }` structure — `select` only reshapes what the hook
 * returns — which is what lets `keepContactAvatarPatched` patch cached pages.
 */
export function useAllPages<TItem>({
  queryKey,
  fetchPage,
  pageSize = DEFAULT_PAGE_SIZE,
  staleTime = DEFAULT_STALE_TIME,
}: {
  queryKey: QueryKey;
  /** Called per page; return the client call for that offset. */
  fetchPage: (args: {
    limit: number;
    offset: number;
  }) => Promise<{ status: number; data?: unknown }>;
  pageSize?: number;
  staleTime?: number;
}) {
  const query = useInfiniteQuery({
    queryKey,
    queryFn: ({ pageParam }) =>
      unwrapAsync(
        fetchPage({ limit: pageSize, offset: pageParam }),
      ) as Promise<Page<TItem> | null>,
    getNextPageParam: (lastPage, pages) => {
      const loaded = pages.length * pageSize;
      return loaded < (lastPage?.pagination.total ?? 0) ? loaded : undefined;
    },
    initialPageParam: 0,
    select: (data) => data.pages.flatMap((page) => page?.items ?? []),
    staleTime,
  });

  // Keep pulling the next page until the list is complete.
  //
  // The loop guard is structural rather than flag-based. When a page after the
  // first fails, react-query retains the earlier pages while `hasNextPage`
  // stays true and `isFetchingNextPage` clears — and the error flags are not a
  // reliable gate, because calling `fetchNextPage()` again clears them for the
  // duration of the retry. A guard built on `isError` / `isFetchNextPageError`
  // therefore re-opens on the very next render and the effect spins in an
  // endless fetch/fail loop (measured: 200+ requests in 500ms).
  //
  // Instead we allow at most one auto-advance per successful data update.
  // `dataUpdatedAt` only moves when a fetch actually lands data, so a failed
  // page cannot unlock another attempt, while a successful page (or an explicit
  // `refetch()`) does — which is exactly the recovery path.
  //
  // Note for consumers: after a mid-list failure the query exposes BOTH the
  // retained pages and `error` (`status` becomes "error" despite `data` being
  // present), so screens must not treat `error` as "there is nothing to show".
  const lastAdvancedAt = useRef<number | null>(null);

  useEffect(() => {
    if (!query.hasNextPage || query.isFetchingNextPage) return;
    if (lastAdvancedAt.current === query.dataUpdatedAt) return;

    lastAdvancedAt.current = query.dataUpdatedAt;
    query.fetchNextPage();
  }, [
    query.hasNextPage,
    query.isFetchingNextPage,
    query.dataUpdatedAt,
    query.fetchNextPage,
    query,
  ]);

  return query;
}
