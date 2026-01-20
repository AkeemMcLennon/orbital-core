import axios from "axios";
export interface APIClientOptions {
  baseURL?: string;
  getToken?: () => string | Promise<string> | null;
  onUnauthorized?: () => void | Promise<void>;
}

let clientOptions: APIClientOptions | null = null;

/**
 * Initialize the API client with custom configuration
 * Stores configuration for use by client wrapper functions
 */
export function initializeApiClient(options: APIClientOptions) {
  clientOptions = options;
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
