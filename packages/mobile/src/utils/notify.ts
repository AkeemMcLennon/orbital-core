import { Alert } from "react-native";
import { logApiError, toUserError } from "./errors";
import { triggerToast } from "./toast-ref";

/**
 * Single entry point for transient user feedback.
 *
 * Toasts are the primary surface, with `Alert.alert` as a fallback for the
 * windows where no provider is mounted (early boot, or after the tree
 * unmounts) — an error must never be swallowed silently.
 */

export function notifyError(
  error: unknown,
  opts?: { title?: string; message?: string; context?: string; noun?: string },
): void {
  logApiError(opts?.context ?? "notify", error);

  const derived = toUserError(error, { noun: opts?.noun });
  const title = opts?.title ?? derived.title;
  const message = opts?.message ?? derived.message;

  if (!triggerToast({ title, message, kind: "error" })) {
    Alert.alert(title, message);
  }
}

export function notifySuccess(message: string, title = "Done"): void {
  if (!triggerToast({ title, message, kind: "success" })) {
    Alert.alert(title, message);
  }
}

/**
 * Build a react-query `onError` handler that reports through `notifyError`.
 *
 *   onError: mutationErrorToast("tags:create", "Couldn't create tag")
 */
export function mutationErrorToast(
  context: string,
  title: string,
  noun?: string,
): (error: unknown) => void {
  return (error) => notifyError(error, { context, title, noun });
}
