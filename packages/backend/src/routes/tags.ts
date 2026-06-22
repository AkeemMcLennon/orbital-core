import { eq, and } from "drizzle-orm";
import * as z from "zod";
import { tags } from "../database/schema";
import { authProc } from "../middleware/auth";
import { ORPCError } from "@orpc/server";
import { base58IdSchema } from "@orbital/utils";
import { discoverAndAssignForUser } from "../services/tag-discovery";

const TagOutputSchema = z.object({
  id: z.string(),
  name: z.string(),
  color: z.string().nullable(),
});

export const listTags = authProc
  .route({
    method: "GET",
    path: "/tags",
    summary: "List all tags",
    operationId: "listTags",
  })
  .output(z.array(TagOutputSchema))
  .handler(async ({ context }) => {
    const { db, user } = context;
    return db.select().from(tags).where(eq(tags.userId, user.id));
  });

export const createTag = authProc
  .route({
    method: "POST",
    path: "/tags",
    summary: "Create a tag",
    operationId: "createTag",
  })
  .input(
    z.object({
      name: z.string().min(1),
      color: z.string().optional(),
    }),
  )
  .output(TagOutputSchema)
  .handler(async ({ input, context }) => {
    const { db, user } = context;

    const [tag] = await db
      .insert(tags)
      .values({ userId: user.id, name: input.name, color: input.color ?? null })
      .onConflictDoNothing()
      .returning();

    if (!tag) {
      throw new ORPCError("CONFLICT", { message: "Tag name already exists" });
    }

    return tag;
  });

export const updateTag = authProc
  .route({
    method: "PUT",
    path: "/tags/{id}",
    summary: "Update a tag",
    operationId: "updateTag",
  })
  .input(
    z
      .object({
        id: base58IdSchema,
        name: z.string().min(1).optional(),
        color: z.string().optional(),
      })
      .refine((d) => d.name !== undefined || d.color !== undefined, {
        message: "At least one of name or color must be provided",
      }),
  )
  .output(TagOutputSchema)
  .handler(async ({ input, context }) => {
    const { db, user } = context;
    const { id, ...patch } = input;

    const [tag] = await db
      .update(tags)
      .set(patch)
      .where(and(eq(tags.id, id), eq(tags.userId, user.id)))
      .returning();

    if (!tag) {
      throw new ORPCError("NOT_FOUND", { message: "Tag not found" });
    }

    return tag;
  });

export const deleteTag = authProc
  .route({
    method: "DELETE",
    path: "/tags/{id}",
    summary: "Delete a tag",
    operationId: "deleteTag",
  })
  .input(z.object({ id: base58IdSchema }))
  .output(z.object({ success: z.boolean() }))
  .handler(async ({ input, context }) => {
    const { db, user } = context;

    const result = await db
      .delete(tags)
      .where(and(eq(tags.id, input.id), eq(tags.userId, user.id)))
      .returning();

    if (!result || result.length === 0) {
      throw new ORPCError("NOT_FOUND", { message: "Tag not found" });
    }

    return { success: true };
  });

export const discoverTags = authProc
  .route({
    method: "POST",
    path: "/tags/discover",
    summary: "Discover and assign dynamic tags for the current user",
    operationId: "discoverTags",
  })
  .output(
    z.object({
      discovered: z.array(z.string()),
      assignedContacts: z.number(),
    }),
  )
  .handler(async ({ context }) => {
    const { db, user } = context;
    // Manual trigger: runs both passes now for the calling user (no day gate).
    return discoverAndAssignForUser(db, user.id);
  });

export const router = {
  list: listTags,
  create: createTag,
  update: updateTag,
  delete: deleteTag,
  discover: discoverTags,
};

export default router;
