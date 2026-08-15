import { isApiError, isNetworkError } from "@orbital/client";

/**
 * Maps errors to user-facing copy. Lives in the app rather than
 * `@orbital/client` because the wording is product-specific and the client is
 * also consumed by the landing site and test suites.
 */

export type UserFacingError = {
  title: string;
  message: string;
  /** False when retrying cannot help (auth, missing resource, bad input). */
  canRetry: boolean;
};

/**
 * The backend only sends `{ message, status }` — `ORPCError`'s code (CONFLICT,
 * NOT_FOUND, …) is lost on the wire — so `status` is the only machine-readable
 * signal available for branching.
 */
export function toUserError(
  error: unknown,
  opts?: { noun?: string },
): UserFacingError {
  const noun = opts?.noun ?? "item";

  if (isNetworkError(error)) {
    return {
      title: "No connection",
      message: "Couldn't reach Orbital. Check your connection and try again.",
      canRetry: true,
    };
  }

  if (isApiError(error)) {
    const { status } = error;

    if (status === 401) {
      return {
        title: "Session expired",
        message: "Please sign in again.",
        canRetry: false,
      };
    }
    if (status === 403) {
      return {
        title: "Not allowed",
        message: "You don't have access to this.",
        canRetry: false,
      };
    }
    if (status === 404) {
      return {
        title: "Not found",
        message: `This ${noun} no longer exists.`,
        canRetry: false,
      };
    }
    if (status === 408) {
      return {
        title: "Timed out",
        message: "That took too long. Try again.",
        canRetry: true,
      };
    }
    if (status === 429) {
      return {
        title: "Slow down",
        message: "Too many requests. Try again in a moment.",
        canRetry: true,
      };
    }
    if (status >= 500) {
      // Never surface a 5xx body — it may leak internals.
      return {
        title: "Something went wrong",
        message: "Our server had a problem. Try again in a moment.",
        canRetry: true,
      };
    }

    // 400/409/422: the backend authors these strings for humans, and they're
    // the only specificity available without an error code. An "HTTP <n>"
    // message is unwrap()'s fallback for a missing/non-JSON body — not server
    // copy — so don't put it on screen.
    const hasServerMessage =
      !!error.message && !/^HTTP \d+$/.test(error.message);
    return {
      title: "Couldn't complete that",
      message: hasServerMessage
        ? error.message
        : "Please check your input and try again.",
      canRetry: false,
    };
  }

  return {
    title: "Something went wrong",
    message: "Please try again.",
    canRetry: true,
  };
}

export function toUserMessage(
  error: unknown,
  opts?: { noun?: string },
): string {
  return toUserError(error, opts).message;
}

/** Single funnel for error logging — the place to add telemetry later. */
export function logApiError(
  scope: string,
  error: unknown,
  meta?: Record<string, unknown>,
): void {
  console.error(`[error] ${scope}`, {
    status: isApiError(error) ? error.status : undefined,
    message: error instanceof Error ? error.message : String(error),
    ...meta,
  });
}
