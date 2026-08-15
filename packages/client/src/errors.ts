/**
 * Error primitives for the Orbital API client.
 *
 * `customFetch` resolves with a `{ status, data }` envelope for every HTTP
 * response, including 4xx/5xx — it only rejects on a network-level failure.
 * That makes react-query's error channel unreachable for HTTP errors: the
 * promise succeeds, so `isError` stays false and `onError` never fires.
 *
 * `unwrap`/`unwrapAsync` convert an error envelope into a thrown `ApiError` at
 * the react-query boundary (inside `queryFn`/`mutationFn`), which restores
 * `isError`, `onError`, retries, and error boundaries — without changing the
 * envelope contract that the backend test suite asserts against.
 *
 * This file must stay OUTSIDE `src/generated/`, which orval regenerates whole.
 */

export class ApiError extends Error {
  readonly status: number;
  /** Raw error body as sent by the server. For logging, not for display. */
  readonly body: unknown;

  constructor(status: number, message: string, body?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
    // Subclassing Error loses the prototype under some transpile targets
    // (notably Hermes); restore it so `instanceof` works.
    Object.setPrototypeOf(this, ApiError.prototype);
  }
}

/**
 * Metro plus workspace packages can produce duplicate module instances, which
 * defeats `instanceof` across a package boundary — so also accept the shape.
 */
export function isApiError(error: unknown): error is ApiError {
  if (error instanceof ApiError) return true;
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { name?: unknown }).name === "ApiError" &&
    typeof (error as { status?: unknown }).status === "number"
  );
}

/** True when `fetch` itself rejected: offline, DNS, TLS, or an aborted request. */
export function isNetworkError(error: unknown): boolean {
  if (isApiError(error)) return false;
  const message = error instanceof Error ? error.message : String(error ?? "");
  return /network request failed|failed to fetch|fetch failed|networkerror|timeout|timed out|abort/i.test(
    message,
  );
}

/**
 * Only retry failures that could plausibly succeed on a second attempt.
 * A 4xx is deterministic — retrying it just delays the error the user sees.
 */
export function isRetryableError(error: unknown): boolean {
  if (isApiError(error)) {
    return error.status >= 500 || error.status === 408 || error.status === 429;
  }
  return isNetworkError(error);
}

type Envelope = { status: number; data?: unknown };
type SuccessData<T> =
  Extract<T, { status: 200 | 201 | 204 }> extends { data: infer D } ? D : never;

function isEnvelope(value: unknown): value is Envelope {
  return (
    typeof value === "object" &&
    value !== null &&
    "status" in value &&
    typeof (value as Envelope).status === "number"
  );
}

/**
 * Returns the 2xx `data`, or throws `ApiError` for any other status.
 *
 * Non-envelope values pass through unchanged, so this stays a no-op if the
 * client is ever changed to reject on HTTP errors natively.
 */
export function unwrap<T>(response: T): SuccessData<T> {
  if (!isEnvelope(response)) return response as SuccessData<T>;

  if (response.status >= 200 && response.status < 300) {
    return response.data as SuccessData<T>;
  }

  const body = response.data as { message?: unknown } | undefined;
  const message =
    typeof body?.message === "string" && body.message
      ? body.message
      : `HTTP ${response.status}`;
  throw new ApiError(response.status, message, body);
}

/**
 * `unwrap` for a promise, normalizing `undefined` to `null` because react-query
 * rejects `undefined` from a `queryFn` ("Query data cannot be undefined").
 */
export async function unwrapAsync<T>(
  promise: Promise<T>,
): Promise<SuccessData<T> | null> {
  const data = unwrap(await promise);
  return data === undefined ? null : data;
}

/** The success payload a generated client function resolves to, once unwrapped. */
export type Unwrapped<F extends (...args: never[]) => Promise<unknown>> =
  SuccessData<Awaited<ReturnType<F>>>;

/**
 * Build a react-query `mutationFn` from a client function, forwarding the
 * mutation's variables.
 *
 *   mutationFn: unwrapMutationFn(createTag)
 *
 * Only the first argument is forwarded, deliberately. react-query v5 calls
 * `mutationFn(variables, context)`, so handing it a client function directly —
 * `mutationFn: createTag` — would land that `MutationFunctionContext` in the
 * generated function's optional `RequestInit` parameter, leaking react-query
 * internals into `fetch` options. This wrapper makes the terse form the safe
 * one.
 *
 * There is deliberately no query-side equivalent: binding args for a `queryFn`
 * saves nothing over `() => unwrapAsync(getThing(params))`, and a pre-built
 * function stops TypeScript inferring the query's data type whenever another
 * option (`placeholderData`, a `variables`-reading `onSuccess`) is also present.
 */
export function unwrapMutationFn<V, T>(
  fn: (variables: V, ...rest: never[]) => Promise<T>,
): (variables: V) => Promise<SuccessData<T> | null> {
  return (variables: V) => unwrapAsync(fn(variables));
}
