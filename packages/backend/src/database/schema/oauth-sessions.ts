import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";
import { users } from "./users";
import { pk } from "../custom-types";

/**
 * OAuth sessions table - stores temporary OAuth flow state
 * Used for OAuth 2.0 authorization flow to bridge between authenticated RPC endpoint and unauthenticated callback
 *
 * Flow:
 * 1. User calls /rpc/integrations/google/connect (authenticated)
 * 2. Server generates id (UUIDv7), creates row in oauth_sessions
 * 3. Frontend receives id and sets it as OAuth state parameter
 * 4. Server receives callback with ?state={id}
 * 5. Callback queries this table WHERE id = state_param
 * 6. Uses userId from session to save integration
 * 7. Deletes session row after use
 */
export const oauthSessions = sqliteTable(
  "oauth_sessions",
  {
    // Primary key - matches OAuth state parameter value sent to frontend
    id: pk(),

    // User who initiated this OAuth flow (from JWT context)
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),

    // OAuth provider ('google', 'github', etc.)
    provider: text("provider").notNull(),

    // Flexible JSON metadata for future expansion
    // Examples: scopes requested, integration config, redirect_uri, etc.
    metadata: text("metadata", { mode: "json" }),

    // Session expiration (5 minutes from creation)
    expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),

    // Creation timestamp
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => ({
    // Multi-tenancy filtering
    userIdIdx: index("oauth_sessions_user_id_idx").on(table.userId),

    // Filter by provider for cleanup/debugging
    providerIdx: index("oauth_sessions_provider_idx").on(
      table.provider,
      table.expiresAt
    ),
  })
);

export type OAuthSession = typeof oauthSessions.$inferSelect;
export type NewOAuthSession = typeof oauthSessions.$inferInsert;
