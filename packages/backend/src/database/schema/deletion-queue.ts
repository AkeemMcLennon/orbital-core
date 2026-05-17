import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { users } from './users';

export const deletionQueue = sqliteTable(
  'deletion_queue',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    requestedAt: integer('requested_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`),
    scheduledDeleteAt: integer('scheduled_delete_at', { mode: 'timestamp' }).notNull(),
    status: text('status', { enum: ['pending', 'canceled', 'completed'] })
      .notNull()
      .default('pending'),
  },
  (t) => [index('deletion_queue_user_id_idx').on(t.userId)],
);

export type DeletionQueueEntry = typeof deletionQueue.$inferSelect;
