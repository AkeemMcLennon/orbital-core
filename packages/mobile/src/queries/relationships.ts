import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  listContactRelationships,
  createRelationship,
  deleteRelationship,
  getSuccessData,
} from "@orbital/client";
import type { CreateRelationshipBody } from "@orbital/client";

export const relationshipKeys = {
  forContact: (contactId: string) =>
    ["relationships", contactId] as const,
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
    mutationFn: (body: CreateRelationshipBody) => createRelationship(body),
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
    mutationFn: (relationshipId: string) => deleteRelationship(relationshipId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: relationshipKeys.forContact(contactId),
      });
    },
  });
}
