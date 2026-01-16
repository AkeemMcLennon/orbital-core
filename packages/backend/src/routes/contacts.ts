import { eq, and, desc, type SQL } from "drizzle-orm";
import * as z from "zod";
import { contacts } from "../database/schema";
import { authProc } from "../middleware/auth";
import { ORPCError } from "@orpc/server";
import { base58IdSchema } from "@orbital/utils";

/**
 * List contacts with optional filtering
 */
export const listContacts = authProc
  .route({ method: "GET", path: "/contacts" })
  .input(
    z.object({
      group: z.string().optional(),
      limit: z.coerce.number().int().positive().max(100).default(50),
      offset: z.coerce.number().int().nonnegative().default(0),
    }),
  )
  .handler(async ({ input, context }) => {
    const { db, user } = context;
    const conditions: SQL[] = [eq(contacts.userId, user.id) as SQL];

    if (input.group) {
      conditions.push(
        eq(contacts.group, input.group as "work" | "personal") as SQL,
      );
    }

    const results = await db
      .select()
      .from(contacts)
      .where(and(...conditions))
      .orderBy(desc(contacts.updatedAt))
      .limit(input.limit)
      .offset(input.offset);

    return results;
  });

/**
 * Find a single contact by ID
 */
export const findContact = authProc
  .route({ method: "GET", path: "/contacts/{id}" })
  .input(z.object({ id: base58IdSchema }))
  .handler(async ({ input, context }) => {
    const { db, user } = context;

    const [contact] = await db
      .select()
      .from(contacts)
      .where(
        and(
          eq(contacts.id, input.id) as SQL,
          eq(contacts.userId, user.id) as SQL,
        ),
      )
      .limit(1);

    if (!contact) {
      throw new ORPCError("NOT_FOUND", { message: "Contact not found" });
    }

    return contact;
  });

/**
 * Create a new contact
 */
export const createContact = authProc
  .route({ method: "POST", path: "/contacts" })
  .input(
    z.object({
      name: z.string().min(1),
      email: z.string().email().optional(),
      phone: z.string().optional(),
      avatarUrl: z.string().url().optional(),
      jobTitle: z.string().optional(),
      company: z.string().optional(),
      notes: z.string().optional(),
      group: z.string().optional(),
    }),
  )
  .handler(async ({ input, context }) => {
    const { db, user } = context;

    const [contact] = await db
      .insert(contacts)
      .values({
        userId: user.id,
        name: input.name,
        email: input.email ?? null,
        phone: input.phone ?? null,
        avatarUrl: input.avatarUrl ?? null,
        jobTitle: input.jobTitle ?? null,
        company: input.company ?? null,
        notes: input.notes ?? null,
        group: (input.group as "work" | "personal" | undefined) ?? null,
      })
      .returning();

    return contact;
  });

/**
 * Update an existing contact
 */
export const updateContact = authProc
  .route({ method: "PUT", path: "/contacts/{id}" })
  .input(
    z.object({
      id: base58IdSchema,
      name: z.string().min(1).optional(),
      email: z.string().email().optional(),
      phone: z.string().optional(),
      avatarUrl: z.string().url().optional(),
      jobTitle: z.string().optional(),
      company: z.string().optional(),
      notes: z.string().optional(),
      group: z.string().optional(),
    }),
  )
  .handler(async ({ input, context }) => {
    const { db, user } = context;

    // Build update object only with provided fields
    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if (input.name !== undefined) updateData.name = input.name;
    if (input.email !== undefined) updateData.email = input.email;
    if (input.phone !== undefined) updateData.phone = input.phone;
    if (input.avatarUrl !== undefined) updateData.avatarUrl = input.avatarUrl;
    if (input.jobTitle !== undefined) updateData.jobTitle = input.jobTitle;
    if (input.company !== undefined) updateData.company = input.company;
    if (input.notes !== undefined) updateData.notes = input.notes;
    if (input.group !== undefined) updateData.group = input.group;

    const [contact] = await db
      .update(contacts)
      .set(updateData)
      .where(
        and(
          eq(contacts.id, input.id) as SQL,
          eq(contacts.userId, user.id) as SQL,
        ),
      )
      .returning();

    if (!contact) {
      throw new ORPCError("NOT_FOUND", { message: "Contact not found" });
    }

    return contact;
  });

/**
 * Delete a contact
 */
export const deleteContact = authProc
  .route({ method: "DELETE", path: "/contacts/{id}" })
  .input(z.object({ id: base58IdSchema }))
  .handler(async ({ input, context }) => {
    const { db, user } = context;

    const result = await db
      .delete(contacts)
      .where(
        and(
          eq(contacts.id, input.id) as SQL,
          eq(contacts.userId, user.id) as SQL,
        ),
      )
      .returning();

    if (!result || result.length === 0) {
      throw new ORPCError("NOT_FOUND", { message: "Contact not found" });
    }

    return { success: true };
  });

/**
 * Export router with all contact procedures
 */
export const router = {
  list: listContacts,
  find: findContact,
  create: createContact,
  update: updateContact,
  delete: deleteContact,
};

export default router;
