import { sqliteTable, text, primaryKey, unique, index } from 'drizzle-orm/sqlite-core';
import { users } from './users';
import { contacts } from './contacts';
import { pk, uuidV7 } from '../custom-types';

/**
 * Tags table - flexible categorization for active contacts
 * Each user has their own set of tags
 */
export const tags = sqliteTable('tags', {
  id: pk(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  color: text('color'), // Optional hex code for UI (e.g., '#3B82F6')
}, (table) => ({
  // Ensure a user can't have duplicate tag names
  uniqueName: unique().on(table.userId, table.name),
  // Index for querying tags by user
  userIdIdx: index('tags_user_id_idx').on(table.userId),
}));

/**
 * Contact Tags junction table - many-to-many relationship
 * Links active contacts to their tags
 */
export const contactTags = sqliteTable('contact_tags', {
  contactId: uuidV7('contact_id')
    .notNull()
    .references(() => contacts.id, { onDelete: 'cascade' }),
  tagId: uuidV7('tag_id')
    .notNull()
    .references(() => tags.id, { onDelete: 'cascade' }),
}, (table) => ({
  pk: primaryKey({ columns: [table.contactId, table.tagId] }),
  // Index for querying contacts by tag
  tagIdIdx: index('contact_tags_tag_id_idx').on(table.tagId),
  // Index for querying tags by contact
  contactIdIdx: index('contact_tags_contact_id_idx').on(table.contactId),
}));

export type Tag = typeof tags.$inferSelect;
export type NewTag = typeof tags.$inferInsert;
export type ContactTag = typeof contactTags.$inferSelect;
export type NewContactTag = typeof contactTags.$inferInsert;
