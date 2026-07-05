import { ORPCError, os } from "@orpc/server";
import { createRemoteJWKSet, jwtVerify } from "jose";
import type { IncomingHttpHeaders } from "node:http";
import type { DatabaseClient, DbResolver } from "../database/client";
import { settings } from "../config";
import { getOrCreateUserByExternalId } from "../services/auth";
import { cancelPendingDeletion } from "../services/account-deletion";
import type { User } from "../database/schema/users";
import type { WaitUntil } from "../utils/wait-until";
import { base58IdSchema } from "@orbital/utils";
import { z } from "zod";

// Zod schema for JWT payload validation
const JWTPayloadSchema = z.object({
  sub: z.string().min(1, "JWT 'sub' claim is required"),
  email: z.string().email("JWT 'email' claim must be a valid email"),
  name: z.string().optional(),
  // Tenant the request is scoped to (Base58 UUIDv7). Optional during rollout:
  // tokens minted before the auth service began emitting it won't carry it.
  // `.nullish()` (not `.optional()`) so an explicit `tenant_id: null` — which
  // pre-tenant users' tokens carry, since the claim is emitted from a NULL DB
  // value — is accepted and coerced to `null` below rather than 401-ing.
  tenant_id: base58IdSchema.nullish(),
});

export type JWTPayload = z.infer<typeof JWTPayloadSchema>;

// Only Cloudflare-specific bindings remain in env
export interface CloudflareEnv {
  DB?: D1Database;
}

export interface BaseContext {
  headers: IncomingHttpHeaders;
  env: CloudflareEnv;
  waitUntil: WaitUntil; // Request-scoped background-task runner (see utils/wait-until.ts)
  resolveDb: DbResolver; // How to obtain the request's db (injected by createApp)
}

export interface AuthContext {
  user: User; // Full database user record
  tenantId: string | null; // Verified tenant claim (Base58); null on pre-tenant tokens
  db: DatabaseClient;
  headers: IncomingHttpHeaders; // Request headers for deriving URLs, etc.
  waitUntil: WaitUntil; // Request-scoped background-task runner
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
      const tenantId = payload.tenant_id ?? null;

      // Resolve the database client for this request via the injected strategy
      // (see createApp), given the runtime env and the verified tenant claim.
      const db = await context.resolveDb({ env: context.env, tenantId });

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
          tenantId, // Verified tenant claim
          db,
          headers: context.headers,
          waitUntil: context.waitUntil,
        },
      });
    } catch (error) {
      console.error("JWT verification failed:", error);
      throw new ORPCError("UNAUTHORIZED", {
        message: "Invalid or expired token",
      });
    }
  });
