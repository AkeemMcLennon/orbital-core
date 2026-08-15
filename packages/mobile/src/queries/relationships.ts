import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  listContactRelationships,
  createRelationship,
  deleteRelationship,
  unwrapAsync,
  unwrapMutationFn,
} from "@orbital/client";
import type { CreateRelationshipBody } from "@orbital/client";
import { mutationErrorToast } from "../utils/notify";

export const relationshipKeys = {
  all: ["relationships"] as const,
  forContact: (contactId: string) => ["relationships", contactId] as const,
};

export function useContactRelationships(contactId: string) {
  return useQuery({
    queryKey: relationshipKeys.forContact(contactId),
    queryFn: () => unwrapAsync(listContactRelationships(contactId)),
    staleTime: 5 * 60 * 1000,
    enabled: !!contactId,
  });
}

export function useCreateRelationship() {
  const queryClient = useQueryClient();

  return useMutation({
    // Inline rather than unwrapMutationFn: `onSuccess` reads `variables`, and
    // with a pre-built mutationFn TS infers the variables type from there
    // instead (landing on `void`). The inline arrow anchors it correctly.
    mutationFn: (body: CreateRelationshipBody) =>
      unwrapAsync(createRelationship(body)),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: relationshipKeys.forContact(variables.contactId),
      });
      queryClient.invalidateQueries({
        queryKey: relationshipKeys.forContact(variables.relatedContactId),
      });
    },
    onError: mutationErrorToast(
      "relationships:create",
      "Couldn't add relationship",
    ),
  });
}

export function useDeleteRelationship(contactId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: unwrapMutationFn(deleteRelationship),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: relationshipKeys.forContact(contactId),
      });
    },
    onError: mutationErrorToast(
      "relationships:delete",
      "Couldn't remove relationship",
      "relationship",
    ),
  });
}
