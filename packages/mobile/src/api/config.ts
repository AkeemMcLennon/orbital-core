import Constants from "expo-constants";
import { initializeApiClient } from "@orbital/client";
import * as storage from "../utils/storage";

/**
 * Resolves the backend API base URL
 * Priority:
 * 1. Custom base URL from Dev Settings (if set)
 * 2. Expo dev server IP (for physical devices)
 * 3. localhost (fallback for simulators)
 */
async function resolveBaseUrl(): Promise<string> {
  // Check for custom base URL from Dev Settings
  const customBaseUrl = await storage.getItem("dev_api_base_url");
  if (customBaseUrl) {
    console.log("Using custom API base URL from Dev Settings:", customBaseUrl);
    return customBaseUrl;
  }

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
async function getToken(): Promise<string> {
  try {
    const token = await storage.getItem("auth_token");
    return token || "";
  } catch (error) {
    console.error("Error retrieving auth token:", error);
    return "";
  }
}

/**
 * Initializes the API client for mobile use
 * Should be called once on app startup
 */
export async function configureMobileApi(): Promise<void> {
  const baseURL = await resolveBaseUrl();

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

/**
 * Gets the current API base URL (for debugging)
 */
export async function getCurrentBaseUrl(): Promise<string> {
  return await resolveBaseUrl();
}

export { getToken };
