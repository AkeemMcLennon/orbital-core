import { ORPCError, os } from "@orpc/server";
import { createRemoteJWKSet, jwtVerify } from "jose";
import type { IncomingHttpHeaders } from "node:http";
import { getDbClient } from "../database/client";
import type { DatabaseClient } from "../database/client";
import { settings } from "../config";
import { getOrCreateUserByExternalId } from "../services/auth";
import { cancelPendingDeletion } from "../services/account-deletion";
import type { User } from "../database/schema/users";
import { z } from "zod";

// Zod schema for JWT payload validation
const JWTPayloadSchema = z.object({
  sub: z.string().min(1, "JWT 'sub' claim is required"),
  email: z.string().email("JWT 'email' claim must be a valid email"),
  name: z.string().optional(),
});

export type JWTPayload = z.infer<typeof JWTPayloadSchema>;

// Only Cloudflare-specific bindings remain in env
export interface CloudflareEnv {
  DB?: D1Database;
}

export interface BaseContext {
  headers: IncomingHttpHeaders;
  env: CloudflareEnv;
}

export interface AuthContext {
  user: User; // Full database user record
  db: DatabaseClient;
  headers: IncomingHttpHeaders; // Request headers for deriving URLs, etc.
}

/**
 * Pre-configured authenticated procedure
 *
 * Use this directly in your route handlers - context types are inferred automatically
 *
 * @example
 * ```ts
 * import { authProc } from '../middleware/auth';
 *
 * export const getProfile = authProc
 *   .route({ method: 'GET', path: '/profile' })
 *   .handler(async ({ context }) => {
 *     // context.user and context.db are automatically available
 *     return { userId: context.user.sub };
 *   });
 * ```
 */
export const authProc = os
  .$context<BaseContext>()
  .use(async ({ context, next }) => {
    // Extract authorization header
    const authorization = context.headers.authorization;

    if (!authorization || !authorization.startsWith("Bearer ")) {
      throw new ORPCError("UNAUTHORIZED", {
        message: "Missing or invalid Authorization header",
      });
    }

    const token = authorization.substring(7); // Remove "Bearer " prefix

    // Verify JWT token (or skip verification if in test mode)
    try {
      let rawPayload: unknown;

      if (settings.DISABLE_JWT_VERIFICATION === "true") {
        if (settings.NODE_ENV === "production") {
          throw new Error(
            "DISABLE_JWT_VERIFICATION must not be enabled in production",
          );
        }
        // Test mode: parse token without verification
        const parts = token.split(".");
        if (parts.length !== 3) {
          throw new Error("Invalid JWT format");
        }
        rawPayload = JSON.parse(atob(parts[1]));
      } else {
        // Production mode: verify token with JWKS
        const JWKS = createRemoteJWKSet(new URL(settings.JWKS_URL));
        const result = await jwtVerify(token, JWKS, {
          issuer: settings.JWT_ISSUER,
          ...(settings.JWT_AUDIENCE ? { audience: settings.JWT_AUDIENCE } : {}),
        });
        rawPayload = result.payload;
      }

      // Validate payload with Zod schema
      const validationResult = JWTPayloadSchema.safeParse(rawPayload);
      if (!validationResult.success) {
        throw new ORPCError("UNAUTHORIZED", {
          message: "Invalid JWT claims",
          data: {
            issues: validationResult.error.issues,
          },
        });
      }

      const payload = validationResult.data;

      // Initialize database client
      // Auto-detect D1 when binding is available (Cloudflare Workers)
      const provider = context.env.DB ? "d1" : settings.DB_PROVIDER;
      const db = await getDbClient({
        provider,
        d1: context.env.DB,
        sqlitePath: settings.SQLITE_DB_PATH,
      });

      // Get or create user in database
      const user = await getOrCreateUserByExternalId(db, {
        sub: payload.sub,
        email: payload.email,
        name: payload.name,
      });

      // Cancel any pending deletion when user logs back in
      await cancelPendingDeletion(db, user.id);

      // Pass authenticated context to next handler
      return next({
        context: {
          user, // Full database user object
          db,
          headers: context.headers,
        },
      });
    } catch (error) {
      console.error("JWT verification failed:", error);
      throw new ORPCError("UNAUTHORIZED", {
        message: "Invalid or expired token",
      });
    }
  });
