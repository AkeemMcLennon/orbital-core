import { initializeApiClient } from "@orbital/client";
import {
  fetchDiscoveryAsync,
  type DiscoveryDocument,
  refreshAsync,
} from "expo-auth-session";
import { triggerLogout } from "../utils/auth-ref";
import * as storage from "../utils/storage";

// Cached discovery document (fetched once at startup)
let cachedDiscovery: DiscoveryDocument | null = null;

export interface AuthConfig {
  issuerUrl: string;
  clientId: string;
}

export const DEFAULT_AUTH_CONFIG = {
  issuerUrl: "https://auth.example.com",
  clientId: "orbital-mobile",
  scopes: ["openid", "profile", "email", "offline_access"],
};

export const STORAGE_KEYS = {
  accessToken: "auth_token",
  refreshToken: "auth_refresh_token",
  authIssuerUrl: "auth_issuer_url",
  authClientId: "auth_client_id",
};
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

export async function getAuthConfig(): Promise<AuthConfig> {
  const [issuerUrl, clientId] = await Promise.all([
    storage.getItem(STORAGE_KEYS.authIssuerUrl),
    storage.getItem(STORAGE_KEYS.authClientId),
  ]);
  return {
    issuerUrl: issuerUrl || DEFAULT_AUTH_CONFIG.issuerUrl,
    clientId: clientId || DEFAULT_AUTH_CONFIG.clientId,
  };
}

export async function refreshAccessToken(
  discovery: DiscoveryDocument | null,
): Promise<string | null> {
  if (!discovery) return null;

  const [refreshToken, config] = await Promise.all([
    storage.getItem(STORAGE_KEYS.refreshToken),
    getAuthConfig(),
  ]);
  if (!refreshToken) return null;

  try {
    const tokenResult = await refreshAsync(
      {
        clientId: config.clientId,
        refreshToken,
      },
      discovery,
    );

    if (tokenResult.idToken) {
      await storage.setItem(STORAGE_KEYS.accessToken, tokenResult.idToken);
    }
    if (tokenResult.refreshToken) {
      await storage.setItem(
        STORAGE_KEYS.refreshToken,
        tokenResult.refreshToken,
      );
    }

    return tokenResult.idToken || null;
  } catch (error) {
    console.error("Token refresh failed:", error);
    // Clear expired tokens
    await storage.deleteItem(STORAGE_KEYS.accessToken);
    await storage.deleteItem(STORAGE_KEYS.refreshToken);
    return null;
  }
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
