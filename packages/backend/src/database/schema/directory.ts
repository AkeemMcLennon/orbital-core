import { sqliteTable, text, index, unique } from 'drizzle-orm/sqlite-core';
import { users } from './users';
import { contacts } from './contacts';
import { pk, uuidV7 } from '../custom-types';

/**
 * Directory table - staging area for ALL external contacts
 * Implements the "Promoted Pointer" pattern for contact promotion
 */
export const directory = sqliteTable('directory', {
  id: pk(), // Base58 String (Stored as BLOB)
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),

  // The "Promoted Pointer" - NULL means contact is available for promotion
  activeContactId: uuidV7('active_contact_id').references(() => contacts.id, { onDelete: 'set null' }),

  // Source Identification (Generic - supports multiple import sources)
  source: text('source').notNull(), // e.g., 'google', 'csv', 'manual'
  externalId: text('external_id'), // ID from the source system

  // Core Identity (Raw Data)
  name: text('name').notNull(),
  email: text('email'),
  phone: text('phone'),
  avatarUrl: text('avatar_url'),
  company: text('company'),

  // Store any additional metadata from the source
  rawMetadata: text('raw_metadata', { mode: 'json' }).$type<{
    [key: string]: any;
  }>(),

}, (table) => ({
  // Multi-tenancy filtering
  userIdIdx: index('directory_user_id_idx').on(table.userId),

  // Query available contacts (where activeContactId IS NULL)
  availableIdx: index('directory_available_idx').on(table.userId, table.activeContactId),

  // Prevent duplicate imports from the same source
  uniqueSource: unique().on(table.userId, table.source, table.externalId),
}));

export type DirectoryEntry = typeof directory.$inferSelect;
export type NewDirectoryEntry = typeof directory.$inferInsert;
