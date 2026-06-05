/**
 * Custom fetch function for Orval-generated client
 * Handles URL redirection and header injection
 */
import { getClientOptions } from "./client";

export type UnauthorizedError = {
  status: 401;
};

export type SuccessMessage<T> = {
  status: 200;
  data: T;
};

export type ErrorMessage = {
  message: string;
};

export type APIError = {
  status: number;
  data: ErrorMessage;
};

// Deduplication guard for concurrent token refreshes
let refreshPromise: Promise<string | null> | null = null;

export async function customFetch<T>(
  url: string,
  options?: RequestInit,
): Promise<T> {
  const clientOptions = getClientOptions();
  const baseUrl = clientOptions?.baseURL || "";
  // Redirect hardcoded base URL to configured base URL
  let finalUrl = `${baseUrl}${url}`;

  // Build headers with optional token injection
  const headers = new Headers(
    options?.headers as
      | Record<string, string>
      | [string, string][]
      | Headers
      | undefined,
  );

  if (clientOptions?.getToken) {
    const tokenOrPromise = clientOptions.getToken();
    const token = await Promise.resolve(tokenOrPromise);
    if (token && !headers.has("Authorization")) {
      headers.set("Authorization", `Bearer ${token}`);
    }
  }

  try {
    const response = await fetch(finalUrl, {
      ...options,
      headers,
    });

    const data = await response.json();

    if (!response.ok) {
      console.error(
        `[API Error] ${options?.method || "GET"} ${finalUrl} — ${response.status}`,
        data,
      );

      if (response.status === 401) {
        // If no refreshToken callback, fall through to onUnauthorized immediately
        if (!clientOptions?.refreshToken) {
          clientOptions?.onUnauthorized?.();
          return { status: response.status, data } as T;
        }

        // Deduplicate: reuse in-flight refresh or start a new one
        if (!refreshPromise) {
          refreshPromise = clientOptions.refreshToken().finally(() => {
            refreshPromise = null;
          });
        }

        const newToken = await refreshPromise;

        if (!newToken) {
          clientOptions?.onUnauthorized?.();
          return { status: response.status, data } as T;
        }

        // Retry the original request with the new token
        const retryHeaders = new Headers(
          options?.headers as
            | Record<string, string>
            | [string, string][]
            | Headers
            | undefined,
        );
        retryHeaders.set("Authorization", `Bearer ${newToken}`);

        const retryResponse = await fetch(finalUrl, {
          ...options,
          headers: retryHeaders,
        });

        const retryData = await retryResponse.json();

        if (!retryResponse.ok) {
          console.error(
            `[API Error] ${options?.method || "GET"} ${finalUrl} — ${retryResponse.status} (after refresh)`,
            retryData,
          );
          if (retryResponse.status === 401) {
            clientOptions?.onUnauthorized?.();
          }
        }

        return { status: retryResponse.status, data: retryData } as T;
      }
    }

    return { status: response.status, data } as T;
  } catch (error) {
    console.error(
      `[API Error] ${options?.method || "GET"} ${finalUrl} — Network error:`,
      error,
    );
    throw error;
  }
}
