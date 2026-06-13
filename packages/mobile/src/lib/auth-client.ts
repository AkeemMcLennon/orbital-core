import { createAuthClient } from "better-auth/react";
import { expoClient } from "@better-auth/expo/client";
import { jwtClient } from "better-auth/client/plugins";
import * as SecureStore from "expo-secure-store";

export const authClient = createAuthClient({
  baseURL: "https://auth.example.com",
  basePath: "/",
  plugins: [
    expoClient({
      scheme: "mobile",
      storagePrefix: "orbital",
      storage: SecureStore,
    }),
    jwtClient(),
  ],
});

export type Session = typeof authClient.$Infer.Session;

/**
 * Fetch a JWT from the Better Auth /token endpoint for use as a Bearer token
 * in backend API calls. The expoClient plugin handles the session cookie.
 */
export async function getBearerToken(): Promise<string | null> {
  try {
    const result = await authClient.$fetch<{ token: string }>("/token");
    if (result.data?.token) return result.data.token;
    return null;
  } catch {
    return null;
  }
}
