import { useCallback, useEffect, useMemo, useState } from "react";
import {
  useAutoDiscovery,
  useAuthRequest,
  makeRedirectUri,
  exchangeCodeAsync,
  refreshAsync,
  type TokenResponse,
  type DiscoveryDocument,
} from "expo-auth-session";
import * as WebBrowser from "expo-web-browser";
import * as storage from "../utils/storage";
import { configureMobileApi } from "../api/config";

WebBrowser.maybeCompleteAuthSession();

// ── Defaults ─────────────────────────────────────────────────────────
const DEFAULT_AUTH_CONFIG = {
  issuerUrl: "https://auth.orbital.diy",
  clientId: "orbital-mobile",
  scopes: ["openid", "profile", "email", "offline_access"],
};

const STORAGE_KEYS = {
  accessToken: "auth_token",
  refreshToken: "auth_refresh_token",
  authIssuerUrl: "auth_issuer_url",
  authClientId: "auth_client_id",
};

const redirectUri = makeRedirectUri({
  scheme: "mobile",
  path: "auth-callback",
});
console.log("[useAuth] redirectUri:", redirectUri);

// ── Settings helpers ─────────────────────────────────────────────────

export interface AuthConfig {
  issuerUrl: string;
  clientId: string;
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

export async function setAuthConfig(
  config: Partial<AuthConfig>,
): Promise<void> {
  if (config.issuerUrl !== undefined) {
    if (
      config.issuerUrl &&
      config.issuerUrl !== DEFAULT_AUTH_CONFIG.issuerUrl
    ) {
      await storage.setItem(STORAGE_KEYS.authIssuerUrl, config.issuerUrl);
    } else {
      await storage.deleteItem(STORAGE_KEYS.authIssuerUrl);
    }
  }
  if (config.clientId !== undefined) {
    if (config.clientId && config.clientId !== DEFAULT_AUTH_CONFIG.clientId) {
      await storage.setItem(STORAGE_KEYS.authClientId, config.clientId);
    } else {
      await storage.deleteItem(STORAGE_KEYS.authClientId);
    }
  }
}

// ── JWT decode ──────────────────────────────────────────────────────

export interface UserInfo {
  sub: string;
  email: string;
  name: string;
}

function decodeJwtPayload(token: string): UserInfo | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const payload = JSON.parse(atob(parts[1]));
    return {
      sub: payload.sub ?? "",
      email: payload.email ?? "",
      name: payload.name ?? payload.email ?? "",
    };
  } catch {
    return null;
  }
}

// ── Hook ─────────────────────────────────────────────────────────────

export interface AuthState {
  token: string | null;
  user: UserInfo | null;
  isReady: boolean;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: () => Promise<void>;
  logout: () => Promise<void>;
}

export function useAuth(): AuthState {
  const [token, setToken] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [config, setConfig] = useState(DEFAULT_AUTH_CONFIG);

  // Load stored config + token on mount
  useEffect(() => {
    (async () => {
      const [storedConfig, storedToken] = await Promise.all([
        getAuthConfig(),
        storage.getItem(STORAGE_KEYS.accessToken),
      ]);
      setConfig({ ...DEFAULT_AUTH_CONFIG, ...storedConfig });
      if (storedToken) setToken(storedToken);
      setIsReady(true);
    })();
  }, []);

  const discovery = useAutoDiscovery(config.issuerUrl);
  useEffect(() => {
    console.log("[useAuth] discovery:", JSON.stringify(discovery));
  }, [discovery]);

  const [request, response, promptAsync] = useAuthRequest(
    {
      clientId: config.clientId,
      scopes: DEFAULT_AUTH_CONFIG.scopes,
      usePKCE: true,
      redirectUri,
    },
    discovery,
  );

  // Handle authorization response
  useEffect(() => {
    console.log("[useAuth] response:", JSON.stringify(response));
    if (response?.type !== "success" || !discovery) return;

    const { code } = response.params;
    if (!code) return;

    (async () => {
      try {
        setIsLoading(true);

        // Manual token exchange to debug response
        const tokenEndpoint = (discovery as DiscoveryDocument).tokenEndpoint;
        console.log("[useAuth] tokenEndpoint:", tokenEndpoint);

        const body = new URLSearchParams({
          grant_type: "authorization_code",
          client_id: config.clientId,
          code,
          redirect_uri: redirectUri,
          code_verifier: request?.codeVerifier || "",
        }).toString();

        console.log("[useAuth] token request body:", body);

        const resp = await fetch(tokenEndpoint!, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body,
        });

        console.log("[useAuth] token response status:", resp.status);
        const text = await resp.text();
        console.log("[useAuth] token response body:", text);

        if (!text) {
          throw new Error("Empty response from token endpoint");
        }

        const tokenData = JSON.parse(text);

        if (tokenData.error) {
          throw new Error(
            `Token error: ${tokenData.error} - ${tokenData.error_description}`,
          );
        }

        if (tokenData.id_token) {
          await storage.setItem(STORAGE_KEYS.accessToken, tokenData.id_token);
          setToken(tokenData.access_token);
        }
        if (tokenData.refresh_token) {
          await storage.setItem(
            STORAGE_KEYS.refreshToken,
            tokenData.refresh_token,
          );
        }
        await configureMobileApi();
      } catch (error) {
        console.error("Token exchange failed:", error);
      } finally {
        setIsLoading(false);
      }
    })();
  }, [response, discovery, request?.codeVerifier, config.clientId]);

  const login = useCallback(async () => {
    if (!request) return;
    setIsLoading(true);
    try {
      await promptAsync();
    } finally {
      setIsLoading(false);
    }
  }, [request, promptAsync]);

  const logout = useCallback(async () => {
    await storage.deleteItem(STORAGE_KEYS.accessToken);
    await storage.deleteItem(STORAGE_KEYS.refreshToken);
    setToken(null);
  }, []);

  const isAuthenticated = useMemo(() => token !== null, [token]);
  const user = useMemo(() => (token ? decodeJwtPayload(token) : null), [token]);

  return {
    token,
    user,
    isReady,
    isAuthenticated,
    isLoading,
    login,
    logout,
  };
}

/**
 * Refresh the access token using the stored refresh token.
 * Called from AuthContext on app foreground.
 */
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

    if (tokenResult.id_token) {
      await storage.setItem(STORAGE_KEYS.accessToken, tokenResult.id_token);
    }
    if (tokenResult.refreshToken) {
      await storage.setItem(
        STORAGE_KEYS.refreshToken,
        tokenResult.refreshToken,
      );
    }

    return tokenResult.accessToken;
  } catch (error) {
    console.error("Token refresh failed:", error);
    // Clear expired tokens
    await storage.deleteItem(STORAGE_KEYS.accessToken);
    await storage.deleteItem(STORAGE_KEYS.refreshToken);
    return null;
  }
}
