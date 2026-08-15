import {
  queryOptions,
  useQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import {
  getMemoryReps,
  answerMemoryRep,
  generateMemoryReps,
  unwrapAsync,
} from "@orbital/client";
import { mutationErrorToast } from "../utils/notify";

export const memoryRepKeys = {
  all: ["memoryReps"] as const,
};

/**
 * Single source of truth for the memory-reps list query, shared by the hook and
 * the root layout's prefetch so both can't drift into different cache shapes.
 */
export function memoryRepsListOptions() {
  return queryOptions({
    queryKey: memoryRepKeys.all,
    queryFn: () => unwrapAsync(getMemoryReps()),
    staleTime: 2 * 60 * 1000,
  });
}

export function useMemoryRepsList() {
  return useQuery(memoryRepsListOptions());
}

export function useAnswerMemoryRep() {
  const queryClient = useQueryClient();

  return useMutation({
    // Inline rather than unwrapMutationFn: the mutation takes one object but
    // the client function takes (id, body), so the args need reshaping.
    mutationFn: ({
      id,
      selectedAnswer,
    }: {
      id: string;
      selectedAnswer: number;
    }) => unwrapAsync(answerMemoryRep(id, { selectedAnswer })),
    onSuccess: () => {
      // Delay invalidation so user sees feedback before card disappears
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: memoryRepKeys.all });
      }, 2000);
    },
    onError: mutationErrorToast(
      "memory-reps:answer",
      "Couldn't save your answer",
    ),
  });
}

export function useGenerateMemoryReps() {
  const queryClient = useQueryClient();

  return useMutation({
    // Inline rather than unwrapMutationFn: applies a default for the optional
    // params, which the client function requires as a positional argument.
    mutationFn: (params?: { contactLimit?: number }) =>
      unwrapAsync(generateMemoryReps(params ?? {})),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: memoryRepKeys.all });
    },
    onError: mutationErrorToast(
      "memory-reps:generate",
      "Couldn't generate quizzes",
    ),
  });
}
