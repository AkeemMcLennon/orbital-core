import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  listTags,
  createTag,
  deleteTag,
  unwrapAsync,
  unwrapMutationFn,
} from "@orbital/client";
import { mutationErrorToast } from "../utils/notify";

export const tagKeys = { all: ["tags"] as const };

export function useTags() {
  return useQuery({
    queryKey: tagKeys.all,
    queryFn: () => unwrapAsync(listTags()),
    staleTime: 5 * 60 * 1000,
  });
}

export function useCreateTag() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: unwrapMutationFn(createTag),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: tagKeys.all }),
    // Previously silent: a duplicate name 409s, and its message is worth
    // showing verbatim.
    onError: mutationErrorToast("tags:create", "Couldn't create tag"),
  });
}

export function useDeleteTag() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: unwrapMutationFn(deleteTag),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: tagKeys.all }),
    onError: mutationErrorToast("tags:delete", "Couldn't delete tag", "tag"),
  });
}
