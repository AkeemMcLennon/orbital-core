type ToastPayload = {
  title: string;
  message?: string;
  kind: "error" | "success";
};
type ToastShow = (payload: ToastPayload) => void;

let showToast: ToastShow | null = null;

/**
 * Registered by <ToastBridge /> once the Tamagui ToastProvider is mounted.
 *
 * Mirrors the `auth-ref` pattern so toasts can be raised from plain functions
 * (service helpers, catch blocks, react-query callbacks) without needing to be
 * inside a component to call `useToastController`.
 */
export function setToastHandler(fn: ToastShow | null): void {
  showToast = fn;
}

/** Returns false when no provider is mounted yet, so callers can fall back. */
export function triggerToast(payload: ToastPayload): boolean {
  if (!showToast) return false;
  showToast(payload);
  return true;
}
