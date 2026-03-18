import {
  exchangeCodeAsync,
  makeRedirectUri,
  Prompt,
  useAuthRequest,
  useAutoDiscovery,
} from "expo-auth-session";
import * as WebBrowser from "expo-web-browser";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  configureMobileApi,
  AuthConfig,
  STORAGE_KEYS,
  DEFAULT_AUTH_CONFIG,
} from "../api/config";
import { getAuthMe, getSuccessData } from "@orbital/client";
import * as storage from "../utils/storage";

WebBrowser.maybeCompleteAuthSession();

const redirectUri = makeRedirectUri({
  scheme: "mobile",
  path: "auth-callback",
});
console.log("[useAuth] redirectUri:", redirectUri);

// ── Settings helpers ─────────────────────────────────────────────────

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
  email: string;
  name: string | null;
}

// ── Hook ─────────────────────────────────────────────────────────────

export interface AuthState {
  user: UserInfo | null;
  isReady: boolean;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: () => Promise<void>;
  logout: () => Promise<void>;
  rememberMe: boolean;
  setRememberMe: (value: boolean) => void;
}

export function useAuth(): AuthState {
  const [user, setUser] = useState<UserInfo | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [config] = useState(DEFAULT_AUTH_CONFIG);
  const [rememberMe, setRememberMe] = useState(true);

  // Load stored config + token on mount
  useEffect(() => {
    (async () => {
      await apiReady;
      const me = getSuccessData(await getAuthMe());
      if (me) {
        setUser(me);
      }
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
      ...(rememberMe ? {} : { prompt: Prompt.Login }),
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

        const tokenResult = await exchangeCodeAsync(
          {
            clientId: config.clientId,
            code,
            redirectUri,
            extraParams: {
              code_verifier: request?.codeVerifier || "",
            },
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
        await configureMobileApi();
        const me = getSuccessData(await getAuthMe());
        if (me) {
          setUser(me);
        }
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
    setUser(null);
  }, []);

  const isAuthenticated = useMemo(() => user !== null, [user]);

  return {
    user,
    isReady,
    isAuthenticated,
    isLoading,
    login,
    logout,
    rememberMe,
    setRememberMe,
  };
}

/**
 * Refresh the access token using the stored refresh token.
 * Called from AuthContext on app foreground.
 */

export const apiReady = configureMobileApi().catch((error) => {
  console.error("Failed to configure mobile API:", error);
});
