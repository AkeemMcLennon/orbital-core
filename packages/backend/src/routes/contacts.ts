import {
  eq,
  and,
  asc,
  desc,
  or,
  like,
  isNull,
  inArray,
  sql,
  type SQL,
} from "drizzle-orm";
import * as z from "zod";
import {
  contacts,
  directory,
  contactTags,
  type NewContact,
} from "../database/schema";
import { authProc } from "../middleware/auth";
import { ORPCError } from "@orpc/server";
import { base58IdSchema } from "@orbital/utils";
import { PaginationInputSchema, paginatedSchema } from "../utils/pagination";
import { StorageService } from "../services/storage";
import { generateRepsForNewContact } from "../services/memory-reps";
import {
  assignStaticTags,
  replaceStaticTags,
  fetchContactTags,
  generateDynamicTagsForContact,
  deriveContactFields,
} from "../services/tags";
import { deriveContactRelationships } from "../services/relationships";
import { waitUntil } from "../utils/wait-until";
import { crypto } from "../utils/crypto";
import { settings } from "../config";
import { extractContactFromImage } from "../services/contact-extract";

function shouldEncryptNotes(): boolean {
  return (
    settings.DISABLE_NOTE_ENCRYPTION !== "true" && !!settings.DB_ENCRYPTION_KEY
  );
}

function encryptNotes(
  notes: string | null | undefined,
  userId: string,
): { notes: string | null; notesEncrypted: boolean } {
  if (!notes || !shouldEncryptNotes()) {
    return { notes: notes ?? null, notesEncrypted: false };
  }
  return { notes: crypto.encrypt(notes, userId), notesEncrypted: true };
}

function decryptContact<
  T extends { notes: string | null; notesEncrypted: boolean },
>(contact: T, userId: string): T {
  if (!contact.notesEncrypted || !contact.notes) return contact;
  return { ...contact, notes: crypto.decrypt(contact.notes, userId) };
}

const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
] as const;
type AllowedImageType = (typeof ALLOWED_IMAGE_TYPES)[number];

const MAX_AVATAR_BYTES = 10 * 1024 * 1024; // 10 MB

const IMAGE_EXT: Record<AllowedImageType, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

// Helper for date fields that can be Date objects or ISO strings
const dateField = () =>
  z
    .union([z.date(), z.string().datetime()])
    .transform((val) => (val instanceof Date ? val.toISOString() : val));

const ContactInputSchema = z.object({
  name: z.string().min(1),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  avatarUrl: z.string().url().optional(),
  jobTitle: z.string().optional(),
  company: z.string().optional(),
  birthday: z
    .string()
    .regex(/^(\d{4}-\d{2}-\d{2}|\d{2}-\d{2})$/)
    .optional(),
  notes: z.string().optional(),
  group: z.string().optional(),
  tags: z.array(z.string()).optional(),
});

// Shared output schemas
const ContactOutputSchema = z.object({
  id: z.string(),
  userId: z.string(),
  name: z.string(),
  email: z.string().nullable(),
  phone: z.string().nullable(),
  avatarUrl: z.string().nullable(),
  jobTitle: z.string().nullable(),
  company: z.string().nullable(),
  birthday: z.string().nullable(),
  notes: z.string().nullable(),
  group: z.enum(["work", "personal"]).nullable(),
  lastInteractionAt: dateField().nullable(),
  createdAt: dateField(),
  updatedAt: dateField(),
  tags: z
    .array(
      z.object({
        id: z.string(),
        name: z.string(),
        color: z.string().nullable(),
        isDynamic: z.boolean(),
      }),
    )
    .optional(),
});

const DirectoryEntryOutputSchema = z.object({
  id: z.string(),
  userId: z.string(),
  name: z.string(),
  email: z.string().nullable(),
  phone: z.string().nullable(),
  avatarUrl: z.string().nullable(),
  company: z.string().nullable(),
  birthday: z.string().nullable(),
  source: z.string(),
  externalId: z.string().nullable(),
  activeContactId: z.string().nullable(),
  rawMetadata: z.any().nullable(),
});

/**
 * List contacts with optional filtering
 */
export const listContacts = authProc
  .route({
    method: "GET",
    path: "/contacts",
    summary: "List contacts",
    operationId: "getContacts",
  })
  .input(
    PaginationInputSchema.extend({
      group: z.string().optional(),
      tagId: z.string().optional(),
      sort: z.enum(["date", "name"]).optional().default("date"),
    }),
  )
  .output(paginatedSchema(ContactOutputSchema))
  .handler(async ({ input, context }) => {
    const { db, user } = context;
    const conditions: SQL[] = [eq(contacts.userId, user.id) as SQL];

    if (input.group) {
      conditions.push(
        eq(contacts.group, input.group as "work" | "personal") as SQL,
      );
    }

    if (input.tagId) {
      const subq = (db as any)
        .select({ id: contactTags.contactId })
        .from(contactTags)
        .where(eq(contactTags.tagId, input.tagId));
      conditions.push(inArray(contacts.id, subq) as SQL);
    }
    const [results, countResult] = await Promise.all([
      db
        .select()
        .from(contacts)
        .where(and(...conditions))
        .orderBy(
          input.sort === "name"
            ? asc(contacts.createdAt)
            : desc(
                sql`COALESCE(${contacts.lastInteractionAt}, ${contacts.createdAt})`,
              ),
        )
        .limit(input.limit)
        .offset(input.offset),
      db.$count(contacts, and(...conditions)),
    ]);

    const total = countResult ?? 0;

    return {
      items: results.map((c) => decryptContact(c, user.id)),
      pagination: {
        total,
        limit: input.limit,
        offset: input.offset,
      },
    };
  });

/**
 * Get a single contact by ID
 */
export const getContact = authProc
  .route({
    method: "GET",
    path: "/contacts/{id}",
    summary: "Get contact by ID",
    operationId: "getContactById",
  })
  .input(z.object({ id: base58IdSchema }))
  .output(ContactOutputSchema)
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

    const tagList = await fetchContactTags(db, user.id, contact.id);
    return { ...decryptContact(contact, user.id), tags: tagList };
  });

/**
 * Create a new contact
 */
export const createContact = authProc
  .route({
    method: "POST",
    path: "/contacts",
    summary: "Create contact",
    operationId: "createContact",
  })
  .input(ContactInputSchema)
  .output(ContactOutputSchema)
  .handler(async ({ input, context }) => {
    const { db, user } = context;
    const { notes: encNotes, notesEncrypted } = encryptNotes(
      input.notes,
      user.id,
    );

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
        birthday: input.birthday ?? null,
        notes: encNotes,
        notesEncrypted,
        group: (input.group as "work" | "personal" | undefined) ?? null,
      })
      .returning();

    if (input.tags) {
      await assignStaticTags(db, user.id, contact.id, input.tags);
    }

    waitUntil(generateRepsForNewContact(db, user.id, contact.id));

    if (input.notes) {
      await generateDynamicTagsForContact(
        db,
        user.id,
        contact.id,
        input.notes,
        input.email ?? null,
      );
    }

    const [derived] = await Promise.all([
      input.notes || input.email
        ? deriveContactFields(input.notes ?? "", input.email ?? null)
        : Promise.resolve(null),
      input.notes
        ? deriveContactRelationships(
            db,
            user.id,
            contact.id,
            contact.name,
            input.notes,
          )
        : Promise.resolve(),
    ]);

    if (derived) {
      const patch: Record<string, string> = {};
      if (derived.jobTitle && !contact.jobTitle)
        patch.jobTitle = derived.jobTitle;
      if (derived.company && !contact.company) patch.company = derived.company;
      if (derived.birthday && !contact.birthday)
        patch.birthday = derived.birthday;
      if (Object.keys(patch).length > 0) {
        const [enriched] = await db
          .update(contacts)
          .set({ ...patch, updatedAt: new Date() })
          .where(eq(contacts.id, contact.id))
          .returning();
        return decryptContact(enriched ?? contact, user.id);
      }
    }

    return decryptContact(contact, user.id);
  });

/**
 * Bulk create contacts directly as active contacts
 */
export const bulkCreateContacts = authProc
  .route({
    method: "POST",
    path: "/contacts/bulk",
    summary: "Bulk create contacts",
    operationId: "bulkCreateContacts",
  })
  .input(z.object({ contacts: z.array(ContactInputSchema).min(1).max(500) }))
  .output(z.array(ContactOutputSchema))
  .handler(async ({ input, context }) => {
    const { db, user } = context;

    const values = input.contacts.map((c) => {
      const { notes: encNotes, notesEncrypted } = encryptNotes(
        c.notes,
        user.id,
      );
      return {
        userId: user.id,
        name: c.name,
        email: c.email ?? null,
        phone: c.phone ?? null,
        avatarUrl: c.avatarUrl ?? null,
        jobTitle: c.jobTitle ?? null,
        company: c.company ?? null,
        birthday: c.birthday ?? null,
        notes: encNotes,
        notesEncrypted,
        group: (c.group as "work" | "personal" | undefined) ?? null,
      };
    });

    const created = await db.insert(contacts).values(values).returning();

    for (const contact of created) {
      waitUntil(generateRepsForNewContact(db, user.id, contact.id));
    }

    return created;
  });

/**
 * Update an existing contact
 */
export const updateContact = authProc
  .route({
    method: "PUT",
    path: "/contacts/{id}",
    summary: "Update contact",
    operationId: "updateContact",
  })
  .input(
    z.object({
      id: base58IdSchema,
      name: z.string().min(1).optional(),
      email: z.string().email().optional(),
      phone: z.string().optional(),
      avatarUrl: z.string().url().optional(),
      jobTitle: z.string().optional(),
      company: z.string().optional(),
      birthday: z
        .string()
        .regex(/^(\d{4}-\d{2}-\d{2}|\d{2}-\d{2})$/)
        .optional(),
      notes: z.string().optional(),
      group: z.string().optional(),
      tags: z.array(z.string()).optional(),
    }),
  )
  .output(ContactOutputSchema)
  .handler(async ({ input, context }) => {
    const { db, user } = context;
    const { id, tags: inputTags, ...patch } = input;
    const updateData: typeof patch & {
      updatedAt: Date;
      notesEncrypted?: boolean;
    } = { updatedAt: new Date(), ...patch };

    if (patch.notes !== undefined) {
      const { notes: encNotes, notesEncrypted } = encryptNotes(
        patch.notes,
        user.id,
      );
      updateData.notes = encNotes ?? undefined;
      updateData.notesEncrypted = notesEncrypted;
    }

    const [contact] = await db
      .update(contacts)
      .set(updateData as Partial<NewContact>)
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

    if (inputTags !== undefined) {
      await replaceStaticTags(db, user.id, contact.id, inputTags);
    }

    if (patch.notes !== undefined) {
      const plainNotes = input.notes ?? "";
      if (plainNotes) {
        await generateDynamicTagsForContact(
          db,
          user.id,
          contact.id,
          plainNotes,
          contact.email ?? null,
        );
      }
    }

    if (patch.notes !== undefined || patch.email !== undefined) {
      const plainNotes =
        input.notes ??
        (contact.notes && !contact.notesEncrypted ? contact.notes : null) ??
        "";
      const [derived] = await Promise.all([
        deriveContactFields(plainNotes, contact.email ?? null),
        plainNotes
          ? deriveContactRelationships(
              db,
              user.id,
              contact.id,
              contact.name,
              plainNotes,
            )
          : Promise.resolve(),
      ]);

      if (derived) {
        const enrichPatch: Record<string, string> = {};
        if (derived.jobTitle && !contact.jobTitle)
          enrichPatch.jobTitle = derived.jobTitle;
        if (derived.company && !contact.company)
          enrichPatch.company = derived.company;
        if (derived.birthday && !contact.birthday)
          enrichPatch.birthday = derived.birthday;
        if (Object.keys(enrichPatch).length > 0) {
          const [enriched] = await db
            .update(contacts)
            .set({ ...enrichPatch, updatedAt: new Date() })
            .where(eq(contacts.id, contact.id))
            .returning();
          return decryptContact(enriched ?? contact, user.id);
        }
      }
    }

    return decryptContact(contact, user.id);
  });

/**
 * Delete a contact
 */
export const deleteContact = authProc
  .route({
    method: "DELETE",
    path: "/contacts/{id}",
    summary: "Delete contact",
    operationId: "deleteContact",
  })
  .input(z.object({ id: base58IdSchema }))
  .output(z.object({ success: z.boolean() }))
  .handler(async ({ input, context }) => {
    const { db, user } = context;

    const result = await db
      .delete(contacts)
      .where(and(eq(contacts.id, input.id), eq(contacts.userId, user.id)))
      .returning();

    if (!result || result.length === 0) {
      throw new ORPCError("NOT_FOUND", { message: "Contact not found" });
    }

    return { success: true };
  });

/**
 * Search for contacts in managed contacts by name, email, or company
 */
export const searchContacts = authProc
  .route({
    method: "GET",
    path: "/contacts/search/managed",
    summary: "Search contacts",
    operationId: "searchContacts",
  })
  .input(
    PaginationInputSchema.extend({
      query: z.string().min(1),
    }),
  )
  .output(paginatedSchema(ContactOutputSchema))
  .handler(async ({ input, context }) => {
    const { db, user } = context;
    const queryPattern = `%${input.query}%`;
    const whereClause = and(
      eq(contacts.userId, user.id),
      or(
        like(contacts.name, queryPattern),
        like(contacts.email, queryPattern),
        like(contacts.company, queryPattern),
      ) as SQL,
    );

    const [results, countResult] = await Promise.all([
      db
        .select()
        .from(contacts)
        .where(whereClause)
        .orderBy(desc(contacts.updatedAt))
        .limit(input.limit)
        .offset(input.offset),
      db.$count(contacts, whereClause),
    ]);

    const total = countResult ?? 0;

    return {
      items: results.map((c) => decryptContact(c, user.id)),
      pagination: {
        total,
        limit: input.limit,
        offset: input.offset,
      },
    };
  });

/**
 * List available contacts (from directory, not yet promoted)
 */
export const listAvailable = authProc
  .route({
    method: "GET",
    path: "/contacts/available",
    summary: "List available contacts",
    operationId: "getAvailableContacts",
  })
  .input(
    PaginationInputSchema.extend({
      source: z.string().optional(),
    }),
  )
  .output(paginatedSchema(DirectoryEntryOutputSchema))
  .handler(async ({ input, context }) => {
    const { db, user } = context;
    const conditions: SQL[] = [
      eq(directory.userId, user.id) as SQL,
      isNull(directory.activeContactId) as SQL,
    ];
    if (input.source) {
      conditions.push(eq(directory.source, input.source) as SQL);
    }
    const whereClause = and(...conditions);

    const [results, countResult] = await Promise.all([
      db
        .select()
        .from(directory)
        .where(whereClause)
        .orderBy(desc(directory.id))
        .limit(input.limit)
        .offset(input.offset),
      db.$count(directory, whereClause),
    ]);

    const total = countResult ?? 0;

    return {
      items: results,
      pagination: {
        total,
        limit: input.limit,
        offset: input.offset,
      },
    };
  });

/**
 * Search for contacts in available contacts (directory)
 */
export const searchAvailable = authProc
  .route({
    method: "GET",
    path: "/contacts/search/available",
    summary: "Search available contacts",
    operationId: "searchAvailableContacts",
  })
  .input(
    PaginationInputSchema.extend({
      query: z.string().min(1),
    }),
  )
  .output(paginatedSchema(DirectoryEntryOutputSchema))
  .handler(async ({ input, context }) => {
    const { db, user } = context;
    const queryPattern = `%${input.query}%`;
    const whereClause = and(
      eq(directory.userId, user.id),
      isNull(directory.activeContactId),
      or(
        like(directory.name, queryPattern),
        like(directory.email, queryPattern),
        like(directory.company, queryPattern),
      ) as SQL,
    );

    const [results, countResult] = await Promise.all([
      db
        .select()
        .from(directory)
        .where(whereClause)
        .orderBy(desc(directory.id))
        .limit(input.limit)
        .offset(input.offset),
      db.$count(directory, whereClause),
    ]);

    const total = countResult ?? 0;

    return {
      items: results,
      pagination: {
        total,
        limit: input.limit,
        offset: input.offset,
      },
    };
  });

/**
 * Bulk import contacts into the directory staging area
 */
export const importContacts = authProc
  .route({
    method: "POST",
    path: "/contacts/import",
    summary: "Bulk import contacts to directory",
    operationId: "importContacts",
  })
  .input(
    z.object({
      source: z.string().min(1),
      contacts: z
        .array(
          z.object({
            externalId: z.string().min(1),
            name: z.string().min(1),
            email: z.string().optional(),
            phone: z.string().optional(),
            avatarUrl: z.string().url().optional(),
            company: z.string().optional(),
            birthday: z
              .string()
              .regex(/^(\d{4}-\d{2}-\d{2}|\d{2}-\d{2})$/)
              .optional(),
          }),
        )
        .min(1)
        .max(500),
    }),
  )
  .output(
    z.object({
      imported: z.number(),
      updated: z.number(),
      total: z.number(),
    }),
  )
  .handler(async ({ input, context }) => {
    const { db, user } = context;

    let imported = 0;
    let updated = 0;

    // Process in batches to avoid oversized queries
    for (const contact of input.contacts) {
      const result = await db
        .insert(directory)
        .values({
          userId: user.id,
          source: input.source,
          externalId: contact.externalId,
          name: contact.name,
          email: contact.email ?? null,
          phone: contact.phone ?? null,
          avatarUrl: contact.avatarUrl ?? null,
          company: contact.company ?? null,
          birthday: contact.birthday ?? null,
        })
        .onConflictDoUpdate({
          target: [directory.userId, directory.source, directory.externalId],
          set: {
            name: sql`excluded.name`,
            email: sql`excluded.email`,
            phone: sql`excluded.phone`,
            avatarUrl: sql`excluded.avatar_url`,
            company: sql`excluded.company`,
            birthday: sql`excluded.birthday`,
          },
        })
        .returning();

      if (result.length > 0) {
        // Check if this was an insert or update by comparing created fields
        // For simplicity, count all as imported (new entries won't have activeContactId)
        const entry = result[0];
        if (entry.activeContactId === null) {
          imported++;
        } else {
          updated++;
        }
      }
    }

    return {
      imported,
      updated,
      total: input.contacts.length,
    };
  });

/**
 * Get a pre-signed URL for uploading a contact avatar directly to R2
 */
export const getAvatarUploadUrl = authProc
  .route({
    method: "POST",
    path: "/contacts/{contactId}/avatar-upload-url",
    summary: "Get pre-signed upload URL for a contact avatar",
    operationId: "getAvatarUploadUrl",
  })
  .input(
    z.object({
      contactId: base58IdSchema,
      contentType: z.enum(ALLOWED_IMAGE_TYPES),
      contentLength: z.number().int().positive().max(MAX_AVATAR_BYTES),
    }),
  )
  .output(z.object({ uploadUrl: z.string(), publicUrl: z.string() }))
  .handler(async ({ input, context }) => {
    const { db, user } = context;

    const [contact] = await db
      .select()
      .from(contacts)
      .where(
        and(eq(contacts.userId, user.id), eq(contacts.id, input.contactId)),
      )
      .limit(1);

    if (!contact) {
      throw new ORPCError("NOT_FOUND", { message: "Contact not found" });
    }

    const storage = new StorageService();
    const ext = IMAGE_EXT[input.contentType];
    const key = `avatars/${user.id}/${input.contactId}-${globalThis.crypto.randomUUID()}.${ext}`;
    return storage.getPresignedUploadUrl(
      key,
      input.contentType,
      input.contentLength,
    );
  });

export const extractFromImage = authProc
  .route({ method: "POST", path: "/contacts/extract-from-image" })
  .input(
    z.object({
      image: z.string().min(1),
      mimeType: z.enum(ALLOWED_IMAGE_TYPES),
    }),
  )
  .handler(async ({ input }) => {
    return await extractContactFromImage(input.image, input.mimeType);
  });

/**
 * Export router with all contact procedures
 */
export const router = {
  list: listContacts,
  get: getContact,
  create: createContact,
  bulkCreate: bulkCreateContacts,
  update: updateContact,
  delete: deleteContact,
  search: searchContacts,
  listAvailable,
  searchAvailable,
  import: importContacts,
  getAvatarUploadUrl,
  extractFromImage,
};

export default router;
