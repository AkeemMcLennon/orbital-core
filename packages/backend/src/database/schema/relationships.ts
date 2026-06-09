import { sqliteTable, text, integer, index, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { users } from './users';
import { contacts } from './contacts';
import { pk, uuidV7 } from '../custom-types';

/**
 * Contact Relationships table - dual-row symmetric design
 *
 * Each relationship is stored as TWO rows: A→B and B→A.
 * This makes reads simple (just filter by contactId) but writes must maintain both rows.
 * A `mirrorId` field links each row to its reverse counterpart for easy synchronization.
 */
export const contactRelationships = sqliteTable('contact_relationships', {
  id: pk(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  contactId: uuidV7('contact_id')
    .notNull()
    .references(() => contacts.id, { onDelete: 'cascade' }),
  relatedContactId: uuidV7('related_contact_id')
    .notNull()
    .references(() => contacts.id, { onDelete: 'cascade' }),
  type: text('type').notNull(),
  sentiment: integer('sentiment').notNull().default(0), // -2 strongly dislike, -1 dislike, 0 neutral, 1 like, 2 strongly like
  description: text('description'),
  isDynamic: integer('is_dynamic', { mode: 'boolean' }).notNull().default(false),
  // Link to the mirror row for easy sync
  mirrorId: text('mirror_id'),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
}, (table) => ([
  index('cr_user_id_idx').on(table.userId),
  index('cr_contact_id_idx').on(table.contactId),
  index('cr_related_contact_id_idx').on(table.relatedContactId),
  uniqueIndex('cr_pair_unique_idx').on(table.userId, table.contactId, table.relatedContactId),
]));

export type ContactRelationship = typeof contactRelationships.$inferSelect;
export type NewContactRelationship = typeof contactRelationships.$inferInsert;
