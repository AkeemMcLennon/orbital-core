import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { jwt } from "better-auth/plugins";
import { oauthProvider } from "@better-auth/oauth-provider";
import { expo } from "@better-auth/expo";
import { drizzle } from "drizzle-orm/d1";
import { importPKCS8, SignJWT } from "jose";
import type { Env } from "./types/env";
import * as schema from "./database/schema";

/**
 * Generate an Apple client_secret JWT signed with the .p8 private key.
 * Apple requires this instead of a static secret.
 * @see https://developer.apple.com/documentation/accountorganizationaldatasharing/creating-a-client-secret
 */
async function generateAppleClientSecret(env: {
  APPLE_TEAM_ID: string;
  APPLE_KEY_ID: string;
  APPLE_PRIVATE_KEY: string;
  APPLE_CLIENT_ID: string;
}): Promise<string> {
  const pem = env.APPLE_PRIVATE_KEY.replace(/\\n/g, "\n");
  const privateKey = await importPKCS8(pem, "ES256");

  return new SignJWT({})
    .setProtectedHeader({ alg: "ES256", kid: env.APPLE_KEY_ID })
    .setIssuer(env.APPLE_TEAM_ID)
    .setIssuedAt()
    .setExpirationTime("180d")
    .setAudience("https://appleid.apple.com")
    .setSubject(env.APPLE_CLIENT_ID)
    .sign(privateKey);
}

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
export async function createAuth(env: Env) {
  const db = drizzle(env.DB);

  const socialProviders: Record<string, any> = {};

  if (env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET) {
    socialProviders.google = {
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
    };
  }

  if (
    env.APPLE_CLIENT_ID &&
    env.APPLE_TEAM_ID &&
    env.APPLE_KEY_ID &&
    env.APPLE_PRIVATE_KEY
  ) {
    const appleClientSecret = await generateAppleClientSecret({
      APPLE_TEAM_ID: env.APPLE_TEAM_ID,
      APPLE_KEY_ID: env.APPLE_KEY_ID,
      APPLE_PRIVATE_KEY: env.APPLE_PRIVATE_KEY,
      APPLE_CLIENT_ID: env.APPLE_CLIENT_ID,
    });

    socialProviders.apple = {
      clientId: env.APPLE_CLIENT_ID,
      clientSecret: appleClientSecret,
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
      "exp://",
      "https://appleid.apple.com",
    ],

    plugins: [
      expo(),
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
