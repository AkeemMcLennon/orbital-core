import { eq, and, lt, desc, type SQL } from "drizzle-orm";
import * as z from "zod";
import { contacts, contactRelationships } from "../database/schema";
import { authProc } from "../middleware/auth";
import { ORPCError } from "@orpc/server";
import { base58IdSchema } from "@orbital/utils";
import { PaginationInputSchema, paginatedSchema } from "../utils/pagination";
import {
  fivePointScaleSchema,
  fivePointScaleQuerySchema,
} from "../utils/scale";
import { dateField } from "./schema-helpers";

// Output schema for a relationship
const RelationshipOutputSchema = z.object({
  id: z.string(),
  userId: z.string(),
  contactId: z.string(),
  relatedContactId: z.string(),
  type: z.string(),
  sentiment: fivePointScaleSchema,
  description: z.string().nullable(),
  mirrorId: z.string().nullable(),
  createdAt: dateField(),
  updatedAt: dateField(),
});

// Relationship with related contact info
const RelationshipWithContactSchema = RelationshipOutputSchema.extend({
  relatedContact: z
    .object({
      id: z.string(),
      name: z.string(),
      email: z.string().nullable(),
      avatarUrl: z.string().nullable(),
      company: z.string().nullable(),
      jobTitle: z.string().nullable(),
    })
    .nullable(),
});

/**
 * List relationships for a specific contact
 *
 * Simple query: just filter by contactId - no OR conditions needed.
 * The mirror row handles the reverse direction automatically.
 */
export const listContactRelationships = authProc
  .route({
    method: "GET",
    path: "/contacts/{contactId}/relationships",
    summary: "List relationships for a contact",
    operationId: "listContactRelationships",
  })
  .input(
    PaginationInputSchema.extend({
      contactId: base58IdSchema,
    }),
  )
  .output(paginatedSchema(RelationshipWithContactSchema))
  .handler(async ({ input, context }) => {
    const { db, user } = context;

    // Verify contact belongs to user
    const [contact] = await db
      .select()
      .from(contacts)
      .where(
        and(eq(contacts.id, input.contactId), eq(contacts.userId, user.id)),
      )
      .limit(1);

    if (!contact) {
      throw new ORPCError("NOT_FOUND", { message: "Contact not found" });
    }

    // Simple query - just filter by contactId, no OR needed
    const whereClause = and(
      eq(contactRelationships.userId, user.id) as SQL,
      eq(contactRelationships.contactId, input.contactId) as SQL,
    );

    const [results, countResult] = await Promise.all([
      db
        .select()
        .from(contactRelationships)
        .leftJoin(
          contacts,
          eq(contactRelationships.relatedContactId, contacts.id),
        )
        .where(whereClause)
        .orderBy(desc(contactRelationships.createdAt))
        .limit(input.limit)
        .offset(input.offset),
      db.$count(contactRelationships, whereClause),
    ]);

    const total = countResult ?? 0;

    return {
      items: results.map((r) => ({
        ...r.contact_relationships,
        relatedContact: r.contacts
          ? {
              id: r.contacts.id,
              name: r.contacts.name,
              email: r.contacts.email,
              avatarUrl: r.contacts.avatarUrl,
              company: r.contacts.company,
              jobTitle: r.contacts.jobTitle,
            }
          : null,
      })),
      pagination: {
        total,
        limit: input.limit,
        offset: input.offset,
      },
    };
  });

/**
 * Create a relationship between two contacts
 *
 * Inserts TWO rows: A->B and B->A, with mirrorId linking them.
 */
export const createRelationship = authProc
  .route({
    method: "POST",
    path: "/contacts/relationships",
    summary: "Create a relationship between two contacts",
    operationId: "createRelationship",
  })
  .input(
    z.object({
      contactId: base58IdSchema,
      relatedContactId: base58IdSchema,
      type: z.string().min(1).max(100),
      sentiment: fivePointScaleSchema.optional().default(0),
      description: z.string().max(500).optional(),
    }),
  )
  .output(RelationshipOutputSchema)
  .handler(async ({ input, context }) => {
    const { db, user } = context;

    // Prevent self-relationships
    if (input.contactId === input.relatedContactId) {
      throw new ORPCError("BAD_REQUEST", {
        message: "A contact cannot have a relationship with itself",
      });
    }

    // Verify both contacts belong to user
    const [contactA, contactB] = await Promise.all([
      db
        .select()
        .from(contacts)
        .where(
          and(eq(contacts.id, input.contactId), eq(contacts.userId, user.id)),
        )
        .limit(1),
      db
        .select()
        .from(contacts)
        .where(
          and(
            eq(contacts.id, input.relatedContactId),
            eq(contacts.userId, user.id),
          ),
        )
        .limit(1),
    ]);

    if (!contactA[0]) {
      throw new ORPCError("NOT_FOUND", { message: "Contact not found" });
    }
    if (!contactB[0]) {
      throw new ORPCError("NOT_FOUND", {
        message: "Related contact not found",
      });
    }

    // Check for existing relationship (only need to check one direction since we maintain both)
    const [existing] = await db
      .select()
      .from(contactRelationships)
      .where(
        and(
          eq(contactRelationships.userId, user.id),
          eq(contactRelationships.contactId, input.contactId),
          eq(contactRelationships.relatedContactId, input.relatedContactId),
        ),
      )
      .limit(1);

    if (existing) {
      throw new ORPCError("CONFLICT", {
        message: "A relationship already exists between these contacts",
      });
    }

    // Insert the forward row (A->B)
    const [forwardRow] = await db
      .insert(contactRelationships)
      .values({
        userId: user.id,
        contactId: input.contactId,
        relatedContactId: input.relatedContactId,
        type: input.type,
        sentiment: input.sentiment,
        description: input.description ?? null,
      })
      .returning();

    // Insert the reverse row (B->A)
    const [reverseRow] = await db
      .insert(contactRelationships)
      .values({
        userId: user.id,
        contactId: input.relatedContactId,
        relatedContactId: input.contactId,
        type: input.type,
        sentiment: input.sentiment,
        description: input.description ?? null,
        mirrorId: forwardRow.id,
      })
      .returning();

    // Update the forward row with the mirror ID
    const [updatedForward] = await db
      .update(contactRelationships)
      .set({ mirrorId: reverseRow.id })
      .where(eq(contactRelationships.id, forwardRow.id))
      .returning();

    return updatedForward;
  });

/**
 * Update a relationship
 *
 * Updates both the target row and its mirror row to keep them in sync.
 */
export const updateRelationship = authProc
  .route({
    method: "PUT",
    path: "/contacts/relationships/{id}",
    summary: "Update a relationship",
    operationId: "updateRelationship",
  })
  .input(
    z.object({
      id: base58IdSchema,
      type: z.string().min(1).max(100).optional(),
      sentiment: fivePointScaleSchema.optional(),
      description: z.string().max(500).optional(),
    }),
  )
  .output(RelationshipOutputSchema)
  .handler(async ({ input, context }) => {
    const { db, user } = context;
    const { id, ...patch } = input;

    // Find the relationship
    const [relationship] = await db
      .select()
      .from(contactRelationships)
      .where(
        and(
          eq(contactRelationships.id, id),
          eq(contactRelationships.userId, user.id),
        ),
      )
      .limit(1);

    if (!relationship) {
      throw new ORPCError("NOT_FOUND", { message: "Relationship not found" });
    }

    const updateData: Record<string, unknown> = { updatedAt: new Date() };
    if (patch.type !== undefined) updateData.type = patch.type;
    if (patch.sentiment !== undefined) updateData.sentiment = patch.sentiment;
    if (patch.description !== undefined)
      updateData.description = patch.description;

    // Update the target row
    const [updated] = await db
      .update(contactRelationships)
      .set(updateData)
      .where(
        and(
          eq(contactRelationships.id, id),
          eq(contactRelationships.userId, user.id),
        ),
      )
      .returning();

    // Update the mirror row if it exists
    if (relationship.mirrorId) {
      await db
        .update(contactRelationships)
        .set(updateData)
        .where(
          and(
            eq(contactRelationships.id, relationship.mirrorId),
            eq(contactRelationships.userId, user.id),
          ),
        );
    }

    return updated;
  });

/**
 * Delete a relationship
 *
 * Deletes both the target row and its mirror row.
 */
export const deleteRelationship = authProc
  .route({
    method: "DELETE",
    path: "/contacts/relationships/{id}",
    summary: "Delete a relationship",
    operationId: "deleteRelationship",
  })
  .input(z.object({ id: base58IdSchema }))
  .output(z.object({ success: z.boolean() }))
  .handler(async ({ input, context }) => {
    const { db, user } = context;

    // Find the relationship
    const [relationship] = await db
      .select()
      .from(contactRelationships)
      .where(
        and(
          eq(contactRelationships.id, input.id),
          eq(contactRelationships.userId, user.id),
        ),
      )
      .limit(1);

    if (!relationship) {
      throw new ORPCError("NOT_FOUND", { message: "Relationship not found" });
    }

    // Delete the mirror row first if it exists
    if (relationship.mirrorId) {
      await db
        .delete(contactRelationships)
        .where(
          and(
            eq(contactRelationships.id, relationship.mirrorId),
            eq(contactRelationships.userId, user.id),
          ),
        );
    }

    // Delete the target row
    await db
      .delete(contactRelationships)
      .where(
        and(
          eq(contactRelationships.id, input.id),
          eq(contactRelationships.userId, user.id),
        ),
      );

    return { success: true };
  });

/**
 * List all relationships for the current user (network view)
 *
 * Deduplicates by only returning rows where contactId < relatedContactId
 * to avoid showing both A->B and B->A.
 */
export const listAllRelationships = authProc
  .route({
    method: "GET",
    path: "/contacts/relationships",
    summary: "List all relationships (network view)",
    operationId: "listAllRelationships",
  })
  .input(
    PaginationInputSchema.extend({
      type: z.string().optional(),
      sentiment: fivePointScaleQuerySchema.optional(),
    }),
  )
  .output(paginatedSchema(RelationshipWithContactSchema))
  .handler(async ({ input, context }) => {
    const { db, user } = context;

    // Build conditions: filter by user and deduplicate (contactId < relatedContactId)
    const conditions: SQL[] = [
      eq(contactRelationships.userId, user.id) as SQL,
      lt(
        contactRelationships.contactId,
        contactRelationships.relatedContactId,
      ) as SQL,
    ];

    if (input.type) {
      conditions.push(eq(contactRelationships.type, input.type) as SQL);
    }
    if (input.sentiment !== undefined) {
      conditions.push(
        eq(contactRelationships.sentiment, input.sentiment) as SQL,
      );
    }

    const whereClause = and(...conditions);

    const [results, countResult] = await Promise.all([
      db
        .select()
        .from(contactRelationships)
        .leftJoin(
          contacts,
          eq(contactRelationships.relatedContactId, contacts.id),
        )
        .where(whereClause)
        .orderBy(desc(contactRelationships.createdAt))
        .limit(input.limit)
        .offset(input.offset),
      db.$count(contactRelationships, whereClause),
    ]);

    const total = countResult ?? 0;

    return {
      items: results.map((r) => ({
        ...r.contact_relationships,
        relatedContact: r.contacts
          ? {
              id: r.contacts.id,
              name: r.contacts.name,
              email: r.contacts.email,
              avatarUrl: r.contacts.avatarUrl,
              company: r.contacts.company,
              jobTitle: r.contacts.jobTitle,
            }
          : null,
      })),
      pagination: {
        total,
        limit: input.limit,
        offset: input.offset,
      },
    };
  });

/**
 * Export router with all relationship procedures
 */
export const router = {
  listForContact: listContactRelationships,
  create: createRelationship,
  update: updateRelationship,
  delete: deleteRelationship,
  listAll: listAllRelationships,
};

export default router;
