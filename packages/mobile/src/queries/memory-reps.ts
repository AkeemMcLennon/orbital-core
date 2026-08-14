import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getMemoryReps,
  answerMemoryRep,
  generateMemoryReps,
  getSuccessData,
  unwrapOrThrow,
} from "@orbital/client";

export const memoryRepKeys = {
  all: ["memoryReps"] as const,
};

export function useMemoryRepsList() {
  return useQuery({
    queryKey: memoryRepKeys.all,
    queryFn: () => getMemoryReps(),
    select: getSuccessData,
    staleTime: 2 * 60 * 1000,
    throwOnError: false,
  });
}

export function useAnswerMemoryRep() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      selectedAnswer,
    }: {
      id: string;
      selectedAnswer: number;
    }) =>
      unwrapOrThrow(
        answerMemoryRep(id, { selectedAnswer }),
        "Answer memory rep",
      ),
    onSuccess: () => {
      // Delay invalidation so user sees feedback before card disappears
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: memoryRepKeys.all });
      }, 2000);
    },
  });
}

export function useGenerateMemoryReps() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params?: { contactLimit?: number }) =>
      unwrapOrThrow(generateMemoryReps(params ?? {}), "Generate memory reps"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: memoryRepKeys.all });
    },
  });
}
