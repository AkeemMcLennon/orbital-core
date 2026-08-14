export interface APIClientOptions {
  baseURL?: string;
  getToken?: () => string | Promise<string> | null;
  refreshToken?: () => Promise<string | null>;
  onUnauthorized?: () => void | Promise<void>;
}

let clientOptions: APIClientOptions | null = null;

/**
 * Initialize the API client with custom configuration
 * Stores configuration for use by client wrapper functions
 */
export function initializeApiClient(options: APIClientOptions) {
  clientOptions = {
    ...options,
    onUnauthorized:
      options.onUnauthorized ||
      (() => {
        console.warn("[API] Unauthorized — token expired or invalid");
      }),
  };
}

export function getClientOptions(): APIClientOptions | null {
  return clientOptions;
}

/**
 * Quick initialize with sensible defaults for test environments
 */
export function initializeDefaultClient(
  options: Partial<APIClientOptions> = {},
) {
  initializeApiClient({
    baseURL: options.baseURL,
    getToken: options.getToken,
    onUnauthorized:
      options.onUnauthorized ||
      (() => {
        // For test environment, just log
        console.warn("Unauthorized - token expired");
      }),
  });
}

/**
 * Type guard to check if an API response is successful (2xx status)
 */
export function isSuccess<T extends { status: number }>(
  response: T | null | undefined,
): response is Extract<T, { status: 200 | 201 | 204 }> {
  return (
    response !== null &&
    response !== undefined &&
    response.status >= 200 &&
    response.status < 300
  );
}

/**
 * Await an API call and throw unless it returned 2xx.
 *
 * `customFetch` resolves non-2xx responses instead of rejecting, so an awaited
 * call reads as successful even when the server refused it. Callers that treat
 * "resolved" as "worked" — most notably react-query's `mutationFn`, whose
 * `onSuccess` then fires on failure — should route through this instead.
 *
 * `action` is used to build the thrown message, e.g. "Delete failed with status 404".
 */
export async function unwrapOrThrow<T extends { status: number }>(
  request: Promise<T>,
  action: string,
): Promise<Extract<T, { status: 200 | 201 | 204 }>> {
  const response = await request;
  if (!isSuccess(response)) {
    throw new Error(`${action} failed with status ${response.status}`);
  }
  return response;
}

/**
 * Helper to safely extract data from a successful API response
 */
export function getSuccessData<T extends { status: number; data?: any }>(
  response: T | null | undefined,
): Extract<T, { status: 200 | 201 | 204 }>["data"] | null {
  if (isSuccess(response)) {
    return (response as any).data;
  }
  return null;
}
