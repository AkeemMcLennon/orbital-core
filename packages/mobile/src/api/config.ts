import { initializeApiClient } from "@orbital/client";
import {
  fetchDiscoveryAsync,
  type DiscoveryDocument,
} from "expo-auth-session";
import { refreshAccessToken, getAuthConfig } from "../hooks/useAuth";
import { triggerLogout } from "../utils/auth-ref";
import * as storage from "../utils/storage";

// Cached discovery document (fetched once at startup)
let cachedDiscovery: DiscoveryDocument | null = null;

/**
 * Resolves the backend API base URL
 * Priority:
 * 1. Custom base URL from Dev Settings (if set)
 * 2. Production URL (fallback)
 */
async function resolveBaseUrl(): Promise<string> {
  // Check for custom base URL from Dev Settings
  const customBaseUrl = await storage.getItem("dev_api_base_url");
  if (customBaseUrl) {
    console.log("Using custom API base URL from Dev Settings:", customBaseUrl);
    return customBaseUrl;
  }

  return "https://api.example.com/rpc";
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
  const [baseURL, authConfig] = await Promise.all([
    resolveBaseUrl(),
    getAuthConfig(),
  ]);

  // Fetch and cache OIDC discovery document
  try {
    cachedDiscovery = await fetchDiscoveryAsync(authConfig.issuerUrl);
  } catch (error) {
    console.warn("Failed to fetch OIDC discovery document:", error);
  }

  console.log("Configuring mobile API client:", { baseURL });

  initializeApiClient({
    baseURL,
    getToken,
    refreshToken: async () => {
      const newToken = await refreshAccessToken(cachedDiscovery);
      return newToken;
    },
    onUnauthorized: () => {
      triggerLogout();
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
