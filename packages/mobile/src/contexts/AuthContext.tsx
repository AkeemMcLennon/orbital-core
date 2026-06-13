import React, { createContext, useContext, useEffect } from "react";
import { useAuth, type AuthState } from "../hooks/useAuth";
import { setLogoutHandler } from "../utils/auth-ref";

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const auth = useAuth();

  // Register signOut as the global logout handler so API 401 responses
  // can trigger a sign-out from outside React's component tree.
  useEffect(() => {
    setLogoutHandler(auth.signOut);
  }, [auth.signOut]);

  return <AuthContext.Provider value={auth}>{children}</AuthContext.Provider>;
}

export function useAuthContext(): AuthState {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuthContext must be used within an AuthProvider");
  }
  return context;
}
