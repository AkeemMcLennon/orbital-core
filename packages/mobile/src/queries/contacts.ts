import { useEffect } from "react";
import {
  useQuery,
  useQueryClient,
  useInfiniteQuery,
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
