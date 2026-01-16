import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { users } from './users';
import { pk } from '../custom-types';

/**
 * Contacts table - managed relationships only
 * These are contacts the user actively wants to maintain relationships with
 */
export const contacts = sqliteTable('contacts', {
  id: pk(), // Base58 String (Stored as BLOB)
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),

  // User-Curated Identity
  name: text('name').notNull(),
  email: text('email'),
  phone: text('phone'),
  avatarUrl: text('avatar_url'),

  // Professional Info
  jobTitle: text('job_title'),
  company: text('company'),

  // Context & Categorization
  notes: text('notes'), // Renamed from 'context' - stores relationship context, origin story, etc.
  group: text('group', { enum: ['work', 'personal'] }),

  // Relationship Management
  lastInteractionAt: integer('last_interaction_at', { mode: 'timestamp' }),

  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
}, (table) => ({
  userIdIdx: index('contacts_user_id_idx').on(table.userId),
}));

export type Contact = typeof contacts.$inferSelect;
export type NewContact = typeof contacts.$inferInsert;
