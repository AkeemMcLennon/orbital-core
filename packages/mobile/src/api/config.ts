import { initializeApiClient } from "@orbital/client";
import { triggerLogout } from "../utils/auth-ref";
import * as storage from "../utils/storage";
import { getBearerToken } from "../lib/auth-client";

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

async function resolveBaseUrl(): Promise<string> {
  const customBaseUrl = await storage.getItem("dev_api_base_url");
  if (customBaseUrl) {
    console.log("Using custom API base URL from Dev Settings:", customBaseUrl);
    return customBaseUrl;
  }
  return "https://api.example.com/rpc";
}

async function getToken(): Promise<string> {
  try {
    // Custom dev JWT takes priority (developer-options feature)
    const devToken = await storage.getItem(STORAGE_KEYS.accessToken);
    if (devToken) return devToken;

    const token = await getBearerToken();
    return token ?? "";
  } catch (error) {
    console.error("Error retrieving auth token:", error);
    return "";
  }
}

export async function configureMobileApi(): Promise<void> {
  const baseURL = await resolveBaseUrl();
  console.log("Configuring mobile API client:", { baseURL });

  initializeApiClient({
    baseURL,
    getToken,
    refreshToken: async () => {
      const token = await getBearerToken();
      return token ?? null;
    },
    onUnauthorized: () => {
      triggerLogout();
    },
  });
}

export async function getCurrentBaseUrl(): Promise<string> {
  return await resolveBaseUrl();
}

export { getToken };
