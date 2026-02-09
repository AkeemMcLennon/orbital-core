import { sqliteTable, text, integer, unique, index } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { users } from './users';
import { pk } from '../custom-types';

/**
 * Integrations table - stores OAuth credentials and sync state
 * Supports multiple sources (Google, CSV, etc.) and multiple accounts per source
 */
export const integrations = sqliteTable(
  'integrations',
  {
    id: pk(), // Base58 String (Stored as BLOB)
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    // Source identification (e.g., 'google', 'csv', 'linkedin')
    source: text('source').notNull(),

    // Account identifier from the source (e.g., Google account email)
    // Allows user to connect multiple accounts from same source
    accountId: text('account_id').notNull(),

    // OAuth credentials (encrypted at application level using Fernet)
    accessToken: text('access_token').notNull(),
    refreshToken: text('refresh_token'),
    tokenExpiresAt: integer('token_expires_at', { mode: 'timestamp' }),

    // Sync state tracking for delta-syncs
    lastSyncToken: text('last_sync_token'), // Provider-specific sync token
    lastSyncAt: integer('last_sync_at', { mode: 'timestamp' }),

    // Configuration
    autoPromote: integer('auto_promote', { mode: 'boolean' }).notNull().default(false),

    // Metadata
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`),
    updatedAt: integer('updated_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => ({
    // Multi-tenancy filtering
    userIdIdx: index('integrations_user_id_idx').on(table.userId),

    // Filter by source
    sourceIdx: index('integrations_source_idx').on(table.userId, table.source),

    // Unique constraint: one integration per user per source per account
    uniqueIntegration: unique('integrations_user_source_account_unique').on(
      table.userId,
      table.source,
      table.accountId,
    ),
  }),
);

export type Integration = typeof integrations.$inferSelect;
export type NewIntegration = typeof integrations.$inferInsert;
