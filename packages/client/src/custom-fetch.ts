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

export async function customFetch<T>(
  url: string,
  options?: RequestInit,
): Promise<T> {
  const clientOptions = getClientOptions();
  const baseUrl = clientOptions?.baseURL || "";
  // Redirect hardcoded base URL to configured base URL
  let finalUrl = `${baseUrl}${url}`;

  // Build headers with optional token injection
  const headers = new Headers(options?.headers);

  if (clientOptions?.getToken) {
    const tokenOrPromise = clientOptions.getToken();
    const token = await Promise.resolve(tokenOrPromise);
    if (token && !headers.has("Authorization")) {
      headers.set("Authorization", `Bearer ${token}`);
    }
  }

  const response = await fetch(finalUrl, {
    ...options,
    headers,
  });

  const data = await response.json();

  return { status: response.status, data } as T;
}
