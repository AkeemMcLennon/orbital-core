import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getPreferences,
  updatePreferences,
  unwrapAsync,
  unwrapMutationFn,
} from "@orbital/client";
import { mutationErrorToast } from "../utils/notify";

export const preferenceKeys = {
  all: ["preferences"] as const,
};

export function usePreferences() {
  return useQuery({
    queryKey: preferenceKeys.all,
    // unwrapAsync throws ApiError on a non-2xx, so `isError`/`error` are real,
    // and the cache holds the unwrapped payload — no `select` needed.
    queryFn: () => unwrapAsync(getPreferences()),
    staleTime: 5 * 60 * 1000,
  });
}

export function useUpdatePreferences() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: unwrapMutationFn(updatePreferences),
    onSuccess: (data) => {
      // Only reached on a real 2xx now. Previously an error envelope also
      // landed here and was written straight into the cache, which silently
      // cleared the user's selection on a failed save.
      queryClient.setQueryData(preferenceKeys.all, data);
      queryClient.invalidateQueries({ queryKey: preferenceKeys.all });
    },
    // Error surface lives in the hook, consistent with tags/memory-reps/
    // relationships, so every caller gets the toast without wiring it up.
    onError: mutationErrorToast("preferences:update", "Couldn't save"),
  });
}
