import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getPreferences,
  updatePreferences,
  getSuccessData,
} from "@orbital/client";

export const preferenceKeys = {
  all: ["preferences"] as const,
};

export function usePreferences() {
  return useQuery({
    queryKey: preferenceKeys.all,
    queryFn: () => getPreferences(),
    select: getSuccessData,
    staleTime: 5 * 60 * 1000,
    throwOnError: false,
  });
}

export function useUpdatePreferences() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: { memRepInitialDelayHours?: number }) =>
      updatePreferences(body),
    onSuccess: (res) => {
      // Write the server's echoed value straight into cache so the UI reflects it immediately
      queryClient.setQueryData(preferenceKeys.all, res);
      queryClient.invalidateQueries({ queryKey: preferenceKeys.all });
    },
  });
}
