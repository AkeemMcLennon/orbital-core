import React, { createContext, useContext, useEffect, useState } from "react";
import { AppState, type AppStateStatus } from "react-native";
import { useAutoDiscovery, type DiscoveryDocument } from "expo-auth-session";
import { useAuth, type AuthState } from "../hooks/useAuth";

import { refreshAccessToken } from "../api/config";

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [issuerUrl] = useState("https://auth.orbital.diy");
  const auth = useAuth();

  // Load configured issuer URL

  const discovery = useAutoDiscovery(issuerUrl);

  // Auto-refresh token when app comes to foreground
  useEffect(() => {
    const handleAppState = (nextState: AppStateStatus) => {
      if (nextState === "active" && auth.isAuthenticated) {
        refreshAccessToken(discovery as DiscoveryDocument | null);
      }
    };

    const subscription = AppState.addEventListener("change", handleAppState);
    return () => subscription.remove();
  }, [auth.isAuthenticated, discovery]);

  return <AuthContext.Provider value={auth}>{children}</AuthContext.Provider>;
}

export function useAuthContext(): AuthState {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuthContext must be used within an AuthProvider");
  }
  return context;
}
