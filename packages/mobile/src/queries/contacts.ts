import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getContacts, getContactById, getSuccessData } from "@orbital/client";

type ContactsListData = ReturnType<
  typeof getSuccessData<Awaited<ReturnType<typeof getContacts>>>
>;

export const contactKeys = {
  all: ["contacts"] as const,
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
