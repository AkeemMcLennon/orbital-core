import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  listContactRelationships,
  createRelationship,
  deleteRelationship,
  getSuccessData,
  unwrapOrThrow,
} from "@orbital/client";
import type { CreateRelationshipBody } from "@orbital/client";

export const relationshipKeys = {
  all: ["relationships"] as const,
  forContact: (contactId: string) => ["relationships", contactId] as const,
};

export function useContactRelationships(contactId: string) {
  return useQuery({
    queryKey: relationshipKeys.forContact(contactId),
    queryFn: () => listContactRelationships(contactId),
    select: getSuccessData,
    staleTime: 5 * 60 * 1000,
    enabled: !!contactId,
  });
}

export function useCreateRelationship() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: CreateRelationshipBody) =>
      unwrapOrThrow(createRelationship(body), "Create relationship"),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: relationshipKeys.forContact(variables.contactId),
      });
      queryClient.invalidateQueries({
        queryKey: relationshipKeys.forContact(variables.relatedContactId),
      });
    },
  });
}

export function useDeleteRelationship(contactId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (relationshipId: string) =>
      unwrapOrThrow(deleteRelationship(relationshipId), "Delete relationship"),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: relationshipKeys.forContact(contactId),
      });
    },
  });
}
