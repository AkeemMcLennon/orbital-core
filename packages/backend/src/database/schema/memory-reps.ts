import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { users } from './users';
import { contacts } from './contacts';
import { pk, uuidV7 } from '../custom-types';

export const memoryReps = sqliteTable('memory_reps', {
  id: pk(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  contactId: uuidV7('contact_id')
    .notNull()
    .references(() => contacts.id, { onDelete: 'cascade' }),
  question: text('question').notNull(),
  options: text('options', { mode: 'json' }).$type<string[]>().notNull(),
  correctAnswer: integer('correct_answer').notNull(), // 0-3 index into options
  sourceField: text('source_field').notNull(), // which contact field was quizzed
  questionType: text('question_type').notNull().default('detail'), // "detail" | "identify"
  answeredAt: integer('answered_at', { mode: 'timestamp' }),
  wasCorrect: integer('was_correct', { mode: 'boolean' }),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
}, (table) => ([
  index('memory_reps_user_id_idx').on(table.userId),
  index('memory_reps_contact_id_idx').on(table.contactId),
  index('memory_reps_user_unanswered_idx').on(table.userId, table.answeredAt),
]));

export type MemoryRep = typeof memoryReps.$inferSelect;
export type NewMemoryRep = typeof memoryReps.$inferInsert;
