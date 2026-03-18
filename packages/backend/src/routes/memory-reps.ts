import { eq, and, isNull, or, lte, sql } from "drizzle-orm";
import * as z from "zod";
import { contacts, memoryReps } from "../database/schema";
import { authProc } from "../middleware/auth";
import { ORPCError } from "@orpc/server";
import { base58IdSchema } from "@orbital/utils";
import { PaginationInputSchema, paginatedSchema } from "../utils/pagination";
import { generateMemoryReps } from "../services/memory-reps";

const MemoryRepItemSchema = z.object({
  id: z.string(),
  contactId: z.string(),
  contactName: z.string(),
  contactAvatarUrl: z.string().nullable(),
  question: z.string(),
  options: z.array(z.string()),
  correctAnswer: z.number(),
  sourceField: z.string(),
  questionType: z.string(),
  answeredAt: z.date().nullable(),
  wasCorrect: z.boolean().nullable(),
  scheduledFor: z.date().nullable(),
  createdAt: z.date(),
});

/**
 * List memory reps (default: unanswered only)
 */
export const listMemoryReps = authProc
  .route({
    method: "GET",
    path: "/memory-reps",
    summary: "List memory reps",
    operationId: "getMemoryReps",
  })
  .input(
    PaginationInputSchema.extend({
      includeAnswered: z.coerce.boolean().optional().default(false),
    }),
  )
  .output(paginatedSchema(MemoryRepItemSchema))
  .handler(async ({ input, context }) => {
    const { db, user } = context;

    const conditions = [eq(memoryReps.userId, user.id)];
    if (!input.includeAnswered) {
      conditions.push(isNull(memoryReps.answeredAt));
    }
    // Exclude future-scheduled reps
    conditions.push(
      or(isNull(memoryReps.scheduledFor), lte(memoryReps.scheduledFor, sql`(unixepoch())`))!,
    );

    const whereClause = conditions.length === 1 ? conditions[0]! : and(...conditions)!;

    const [results, countResult] = await Promise.all([
      db
        .select()
        .from(memoryReps)
        .innerJoin(contacts, eq(memoryReps.contactId, contacts.id))
        .where(whereClause)
        .limit(input.limit)
        .offset(input.offset),
      db.$count(memoryReps, whereClause),
    ]);

    const items = results.map((r) => ({
      id: r.memory_reps.id,
      contactId: r.memory_reps.contactId,
      contactName: r.contacts.name,
      contactAvatarUrl: r.contacts.avatarUrl,
      question: r.memory_reps.question,
      options: r.memory_reps.options,
      correctAnswer: r.memory_reps.correctAnswer,
      sourceField: r.memory_reps.sourceField,
      questionType: r.memory_reps.questionType,
      scheduledFor: r.memory_reps.scheduledFor,
      answeredAt: r.memory_reps.answeredAt,
      wasCorrect: r.memory_reps.wasCorrect,
      createdAt: r.memory_reps.createdAt,
    }));

    return {
      items,
      pagination: {
        total: countResult,
        limit: input.limit,
        offset: input.offset,
      },
    };
  });

/**
 * Generate new memory reps from recent contacts
 */
export const generateReps = authProc
  .route({
    method: "POST",
    path: "/memory-reps/generate",
    summary: "Generate memory reps",
    operationId: "generateMemoryReps",
  })
  .input(
    z.object({
      contactLimit: z.coerce.number().int().positive().max(20).optional().default(10),
    }),
  )
  .output(
    z.object({
      generated: z.number(),
      contactsUsed: z.number(),
      items: z.array(MemoryRepItemSchema),
    }),
  )
  .handler(async ({ input, context }) => {
    const { db, user } = context;
    return generateMemoryReps(db, user.id, input.contactLimit);
  });

/**
 * Record answer for a memory rep
 */
export const answerRep = authProc
  .route({
    method: "POST",
    path: "/memory-reps/{id}/answer",
    summary: "Answer a memory rep",
    operationId: "answerMemoryRep",
  })
  .input(
    z.object({
      id: base58IdSchema,
      selectedAnswer: z.number().int().min(0).max(3),
    }),
  )
  .output(
    z.object({
      correct: z.boolean(),
      correctAnswer: z.number(),
    }),
  )
  .handler(async ({ input, context }) => {
    const { db, user } = context;

    // Find the rep
    const [rep] = await db
      .select()
      .from(memoryReps)
      .where(
        and(
          eq(memoryReps.id, input.id),
          eq(memoryReps.userId, user.id),
        ),
      )
      .limit(1);

    if (!rep) {
      throw new ORPCError("NOT_FOUND", { message: "Memory rep not found" });
    }

    if (rep.answeredAt !== null) {
      throw new ORPCError("CONFLICT", { message: "Memory rep already answered" });
    }

    const correct = input.selectedAnswer === rep.correctAnswer;

    await db
      .update(memoryReps)
      .set({
        answeredAt: new Date(),
        wasCorrect: correct,
      })
      .where(eq(memoryReps.id, input.id));

    return {
      correct,
      correctAnswer: rep.correctAnswer,
    };
  });

export const router = {
  list: listMemoryReps,
  generate: generateReps,
  answer: answerRep,
};

export default router;
