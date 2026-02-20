import { sqliteTable, text, integer, index, unique } from 'drizzle-orm/sqlite-core';
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
  birthday: text('birthday'), // "YYYY-MM-DD" (with year) or "MM-DD" (without year)

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

/**
 * Contact Channels table - overflow contact methods for managed contacts
 * Handles multiple emails, phones, and social handles per contact
 */
export const contactChannels = sqliteTable(
  'contact_channels',
  {
    id: pk(), // Base58 String (Stored as BLOB)
    contactId: text('contact_id')
      .notNull()
      .references(() => contacts.id, { onDelete: 'cascade' }),

    // Channel type (email, phone, or social)
    type: text('type', { enum: ['email', 'phone', 'linkedin', 'twitter', 'other'] }).notNull(),

    // The actual value (email address, phone number, or social URL)
    value: text('value').notNull(),

    // Optional label (e.g., 'work', 'home', 'personal')
    label: text('label'),

    // Mark if this is the primary channel of its type
    isPrimary: integer('is_primary', { mode: 'boolean' }).default(false),

    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => ({
    // Fast lookups for contact channels
    contactIdIdx: index('contact_channels_contact_id_idx').on(table.contactId),

    // O(log N) lookup by value for exact matching
    valueIdx: index('contact_channels_value_idx').on(table.value),

    // Filter by type
    typeIdx: index('contact_channels_type_idx').on(table.type),

    // Prevent duplicate channels on same contact
    uniqueChannel: unique('contact_channels_unique').on(table.contactId, table.type, table.value),
  }),
);

export type ContactChannel = typeof contactChannels.$inferSelect;
export type NewContactChannel = typeof contactChannels.$inferInsert;
