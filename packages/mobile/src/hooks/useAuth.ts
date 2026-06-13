import { useCallback, useEffect, useMemo, useState } from "react";
import { authClient } from "../lib/auth-client";
import { configureMobileApi } from "../api/config";
import { getAuthMe, getSuccessData } from "@orbital/client";

export interface UserInfo {
  email: string;
  name: string | null;
}

export interface AuthError {
  message: string;
  code?: string;
}

export interface AuthState {
  user: UserInfo | null;
  isReady: boolean;
  isAuthenticated: boolean;
  isLoading: boolean;
  signInWithEmail: (
    email: string,
    password: string,
  ) => Promise<AuthError | null>;
  signUpWithEmail: (
    name: string,
    email: string,
    password: string,
  ) => Promise<AuthError | null>;
  signInWithGoogle: () => Promise<void>;
  signInWithApple: () => Promise<void>;
  signOut: () => Promise<void>;
  rememberMe: boolean;
  setRememberMe: (value: boolean) => void;
}

export const apiReady = configureMobileApi().catch((error) => {
  console.error("Failed to configure mobile API:", error);
});

export function useAuth(): AuthState {
  const { data: session, isPending } = authClient.useSession();
  const [user, setUser] = useState<UserInfo | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);

  // Once the Better Auth session is resolved, fetch the backend user profile
  useEffect(() => {
    if (isPending) return;

    (async () => {
      await apiReady;
      if (session?.user) {
        const me = getSuccessData(await getAuthMe());
        if (me) {
          setUser(me);
        } else {
          setUser({
            email: session.user.email,
            name: session.user.name ?? null,
          });
        }
      } else {
        setUser(null);
      }
      setIsReady(true);
    })();
  }, [isPending, session]);

  const signInWithEmail = useCallback(
    async (email: string, password: string): Promise<AuthError | null> => {
      setIsLoading(true);
      try {
        const { error } = await authClient.signIn.email({
          email,
          password,
          rememberMe,
        });
        if (error) {
          return {
            message: error.message ?? "Sign in failed",
            code: error.code,
          };
        }
        await configureMobileApi();
        const me = getSuccessData(await getAuthMe());
        if (me) setUser(me);
        return null;
      } catch (err) {
        return {
          message: err instanceof Error ? err.message : "Sign in failed",
        };
      } finally {
        setIsLoading(false);
      }
    },
    [rememberMe],
  );

  const signUpWithEmail = useCallback(
    async (
      name: string,
      email: string,
      password: string,
    ): Promise<AuthError | null> => {
      setIsLoading(true);
      try {
        const { error } = await authClient.signUp.email({
          name,
          email,
          password,
        });
        if (error) {
          return {
            message: error.message ?? "Sign up failed",
            code: error.code,
          };
        }
        await configureMobileApi();
        const me = getSuccessData(await getAuthMe());
        if (me) setUser(me);
        return null;
      } catch (err) {
        return {
          message: err instanceof Error ? err.message : "Sign up failed",
        };
      } finally {
        setIsLoading(false);
      }
    },
    [],
  );

  const signInWithGoogle = useCallback(async () => {
    setIsLoading(true);
    try {
      await authClient.signIn.social({
        provider: "google",
        callbackURL: "/auth-callback",
      });
    } finally {
      setIsLoading(false);
    }
  }, []);

  const signInWithApple = useCallback(async () => {
    setIsLoading(true);
    try {
      await authClient.signIn.social({
        provider: "apple",
        callbackURL: "/auth-callback",
      });
    } finally {
      setIsLoading(false);
    }
  }, []);

  const signOut = useCallback(async () => {
    await authClient.signOut();
    setUser(null);
  }, []);

  const isAuthenticated = useMemo(() => user !== null, [user]);

  return {
    user,
    isReady,
    isAuthenticated,
    isLoading,
    signInWithEmail,
    signUpWithEmail,
    signInWithGoogle,
    signInWithApple,
    signOut,
    rememberMe,
    setRememberMe,
  };
}
