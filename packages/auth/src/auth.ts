import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { jwt } from "better-auth/plugins";
import { oauthProvider } from "@better-auth/oauth-provider";
import { drizzle } from "drizzle-orm/d1";
import type { Env } from "./types/env";
import * as schema from "./database/schema";

/**
 * Creates a BetterAuth instance per-request (required for D1 binding access).
 *
 * Exposes:
 * - Email/password authentication
 * - Google + Apple social sign-in (when configured)
 * - OAuth 2.1 Provider (authorization code + PKCE)
 * - JWT access tokens with JWKS verification endpoint
 * - OIDC discovery at /.well-known/openid-configuration
 */
export function createAuth(env: Env) {
  const db = drizzle(env.DB);

  const socialProviders: Record<string, any> = {};

  if (env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET) {
    socialProviders.google = {
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
    };
  }

  if (env.APPLE_CLIENT_ID && env.APPLE_CLIENT_SECRET) {
    socialProviders.apple = {
      clientId: env.APPLE_CLIENT_ID,
      clientSecret: env.APPLE_CLIENT_SECRET,
      appBundleIdentifier:
        env.APPLE_APP_BUNDLE_IDENTIFIER || "diy.orbital.mobile",
    };
  }

  return betterAuth({
    basePath: "/",
    baseURL: env.BETTER_AUTH_URL,
    secret: env.BETTER_AUTH_SECRET,

    database: drizzleAdapter(db, {
      provider: "sqlite",
      schema,
    }),

    emailAndPassword: {
      enabled: true,
    },

    socialProviders:
      Object.keys(socialProviders).length > 0 ? socialProviders : undefined,

    trustedOrigins: [
      "mobile://",
      "diy.orbital.mobile://",
      "mobile://auth-callback",
    ],

    // Disable the default /token endpoint — OAuth provider plugin handles it
    disabledPaths: ["/token"],

    plugins: [
      jwt({
        jwt: {
          issuer: env.BETTER_AUTH_URL,
          audience: env.BETTER_AUTH_URL,
          expirationTime: "1h",
          definePayload: ({ user }) => ({
            sub: user.id,
            email: user.email,
            name: user.name,
          }),
        },
        jwks: {
          keyPairConfig: {
            alg: "RS256",
          },
        },
      }),
      oauthProvider({
        loginPage: "/sign-in",
        consentPage: "/consent",
        accessTokenExpiresIn: 3600,
        refreshTokenExpiresIn: 30 * 24 * 3600,
        scopes: ["openid", "profile", "email", "offline_access"],
        cachedTrustedClients: new Set(["orbital-mobile"]),
        customAccessTokenClaims: ({ user }) => ({
          sub: user?.id ?? "",
          email: user?.email ?? "",
          name: user?.name ?? undefined,
        }),
      }),
    ],
  });
}
