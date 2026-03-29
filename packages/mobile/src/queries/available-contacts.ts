import { useEffect } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { getAvailableContacts, getSuccessData } from "@orbital/client";

const PAGE_SIZE = 100;

export const availableContactKeys = {
  all: ["available-contacts"] as const,
};

export function useAllAvailableContactsList() {
  const query = useInfiniteQuery({
    queryKey: availableContactKeys.all,
    queryFn: ({ pageParam }) =>
      getAvailableContacts({ limit: PAGE_SIZE, offset: pageParam }),
    getNextPageParam: (lastPage, pages) => {
      const data = getSuccessData(lastPage);
      const loaded = pages.length * PAGE_SIZE;
      return loaded < (data?.pagination.total ?? 0) ? loaded : undefined;
    },
    initialPageParam: 0,
    select: (data) =>
      data.pages.flatMap((p) => getSuccessData(p)?.items ?? []),
    staleTime: 5 * 60 * 1000,
    throwOnError: false,
  });

  useEffect(() => {
    if (query.hasNextPage && !query.isFetchingNextPage) {
      query.fetchNextPage();
    }
  }, [query.hasNextPage, query.isFetchingNextPage, query.fetchNextPage]);

  return query;
}
