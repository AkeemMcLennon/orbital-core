import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  listTags,
  createTag,
  deleteTag,
  getSuccessData,
  unwrapOrThrow,
} from "@orbital/client";

export const tagKeys = { all: ["tags"] as const };

export function useTags() {
  return useQuery({
    queryKey: tagKeys.all,
    queryFn: listTags,
    select: getSuccessData,
    staleTime: 5 * 60 * 1000,
    throwOnError: false,
  });
}

export function useCreateTag() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: { name: string; color?: string }) =>
      unwrapOrThrow(createTag(body), "Create tag"),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: tagKeys.all }),
  });
}

export function useDeleteTag() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => unwrapOrThrow(deleteTag(id), "Delete tag"),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: tagKeys.all }),
  });
}
