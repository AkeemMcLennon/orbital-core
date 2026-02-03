import Constants from "expo-constants";
import { initializeApiClient } from "@orbital/client";
import * as storage from "../utils/storage";

/**
 * Resolves the backend API base URL
 * For physical devices: Uses the dev server IP from Constants.expoConfig.hostUri
 * For simulators: Falls back to localhost
 */
function resolveBaseUrl(): string {
  const hostUri = Constants.expoConfig?.hostUri;

  if (hostUri) {
    // Extract IP address from hostUri (format: "192.168.x.x:port" or "localhost:port")
    const ip = hostUri.split(":")[0];
    return `http://${ip}:8787/rpc`;
  }

  // Fallback to localhost for simulators
  return "http://localhost:8787/rpc";
}

/**
 * Retrieves the authentication token from secure storage
 */
async function getToken(): Promise<string | null> {
  try {
    const token = await storage.getItem("auth_token");
    return token || null;
  } catch (error) {
    console.error("Error retrieving auth token:", error);
    return null;
  }
}

/**
 * Initializes the API client for mobile use
 * Should be called once on app startup
 */
export function configureMobileApi(): void {
  const baseURL = resolveBaseUrl();

  console.log("Configuring mobile API client:", { baseURL });

  initializeApiClient({
    baseURL,
    getToken,
    onUnauthorized: () => {
      console.warn("Unauthorized - authentication token expired or invalid");
      // TODO: Trigger logout or re-authentication flow
    },
  });
}

export { getToken };
