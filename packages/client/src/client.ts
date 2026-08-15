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
 * Helper to safely extract data from a successful API response.
 *
 * Note this maps ANY non-2xx to `null`, which makes an error indistinguishable
 * from an empty result and keeps react-query from ever seeing a failure.
 *
 * @deprecated In react-query code use `unwrapAsync` from `./errors` inside
 * `queryFn`/`mutationFn` instead, so HTTP errors surface as thrown `ApiError`s.
 * Still the right helper for tests that assert on status codes.
 */
export function getSuccessData<T extends { status: number; data?: any }>(
  response: T | null | undefined,
): Extract<T, { status: 200 | 201 | 204 }>["data"] | null {
  if (isSuccess(response)) {
    return (response as any).data;
  }
  return null;
}
