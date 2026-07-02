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
import type { DatabaseClient } from "../database/client";
import * as z from "zod";
import {
  contacts,
  contactChannels,
  directory,
  contactTags,
  tags as tagsTable,
  type NewContact,
  type Contact,
} from "../database/schema";
import { getPreferenceValue, PrefKey } from "../services/preferences";
import type { User } from "../database/schema/users";
import { authProc } from "../middleware/auth";
import { ORPCError } from "@orpc/server";
import { base58IdSchema } from "@orbital/utils";
import { PaginationInputSchema, paginatedSchema } from "../utils/pagination";
import { fivePointScaleSchema } from "../utils/scale";
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
import type { WaitUntil } from "../utils/wait-until";
import { crypto } from "../utils/crypto";
import { settings } from "../config";
import { extractContactFromImage } from "../services/contact-extract";
import {
  meilisearchService,
  isMeilisearchConfigured,
} from "../services/meilisearch";

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

const SOCIAL_LINK_TYPES = [
  "linkedin",
  "twitter",
  "instagram",
  "facebook",
  "github",
  "youtube",
  "tiktok",
  "website",
  "other",
] as const;

const ContactLinkInputSchema = z.object({
  type: z.enum(SOCIAL_LINK_TYPES),
  value: z.string().min(1).max(2048),
  label: z.string().optional(),
});

const ContactLinkOutputSchema = z.object({
  id: z.string(),
  type: z.enum(SOCIAL_LINK_TYPES),
  value: z.string(),
  label: z.string().nullable(),
  createdAt: dateField(),
});

async function fetchContactLinks(db: DatabaseClient, contactId: string) {
  const rows = await db
    .select()
    .from(contactChannels)
    .where(
      and(
        eq(contactChannels.contactId, contactId) as SQL,
        inArray(contactChannels.type, [...SOCIAL_LINK_TYPES]) as SQL,
      ),
    )
    .orderBy(asc(contactChannels.createdAt));
  return rows.map(({ id, type, value, label, createdAt }) => ({
    id,
    type: type as (typeof SOCIAL_LINK_TYPES)[number],
    value,
    label,
    createdAt,
  }));
}

/**
 * Replace all social-typed channels for a contact with the given set.
 * Input is deduped first: the (contactId, type, value) unique constraint
 * would otherwise abort the insert after existing rows were deleted.
 */
async function replaceContactLinks(
  db: DatabaseClient,
  contactId: string,
  links: Array<z.infer<typeof ContactLinkInputSchema>>,
) {
  await db
    .delete(contactChannels)
    .where(
      and(
        eq(contactChannels.contactId, contactId) as SQL,
        inArray(contactChannels.type, [...SOCIAL_LINK_TYPES]) as SQL,
      ),
    );
  const seen = new Set<string>();
  const deduped = links.filter((l) => {
    const key = `${l.type} ${l.value}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  if (deduped.length) {
    await db
      .insert(contactChannels)
      .values(
        deduped.map((l) => ({
          contactId,
          type: l.type,
          value: l.value,
          label: l.label ?? null,
        })),
      )
      .onConflictDoNothing();
  }
}

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
  strength: fivePointScaleSchema.optional().default(0),
  tags: z.array(z.string()).optional(),
  links: z.array(ContactLinkInputSchema).optional(),
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
  strength: fivePointScaleSchema.nullable(),
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
  links: z.array(ContactLinkOutputSchema).optional(),
});

/**
 * Shared tail for createContact and updateContact: regenerate dynamic tags,
 * derive fields + relationships from notes/email, enrich empty fields, then
 * fetch tags/links, index into Meilisearch, and shape the response.
 *
 * The two callers differ only in which notes string drives each step:
 * - `notesForDynamicTags` — notes written *this request* (regen dynamic tags when truthy)
 * - `deriveInput` — notes to derive fields/relationships from (may be existing notes on update)
 */
async function finalizeContactWrite(
  db: DatabaseClient,
  user: User,
  contact: Contact,
  waitUntil: WaitUntil,
  opts: {
    notesForDynamicTags: string | null;
    deriveInput: { notes: string; email: string | null } | null;
  },
): Promise<z.input<typeof ContactOutputSchema>> {
  if (opts.notesForDynamicTags) {
    await generateDynamicTagsForContact(
      db,
      user.id,
      contact.id,
      opts.notesForDynamicTags,
      contact.email ?? null,
    );
  }

  let derived: Awaited<ReturnType<typeof deriveContactFields>> = null;
  if (opts.deriveInput) {
    [derived] = await Promise.all([
      deriveContactFields(opts.deriveInput.notes, opts.deriveInput.email),
      opts.deriveInput.notes
        ? deriveContactRelationships(
            db,
            user.id,
            contact.id,
            contact.name,
            opts.deriveInput.notes,
          )
        : Promise.resolve(),
    ]);
  }

  const [tagList, links] = await Promise.all([
    fetchContactTags(db, user.id, contact.id),
    fetchContactLinks(db, contact.id),
  ]);

  let finalContact = contact;
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
      finalContact = enriched ?? contact;
    }
  }

  waitUntil(
    meilisearchService.indexContact(
      finalContact,
      tagList.map((t) => t.name),
    ),
  );

  return { ...decryptContact(finalContact, user.id), tags: tagList, links };
}

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

    const [tagList, links] = await Promise.all([
      fetchContactTags(db, user.id, contact.id),
      fetchContactLinks(db, contact.id),
    ]);
    return { ...decryptContact(contact, user.id), tags: tagList, links };
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
        strength: input.strength,
      })
      .returning();

    if (input.tags) {
      await assignStaticTags(db, user.id, contact.id, input.tags);
    }

    if (input.links?.length) {
      await replaceContactLinks(db, contact.id, input.links);
    }

    const initialDelayHours = await getPreferenceValue(
      db,
      user.id,
      PrefKey.MemRepInitialDelayHours,
    );

    context.waitUntil(
      generateRepsForNewContact(db, user.id, contact.id, initialDelayHours),
    );

    return finalizeContactWrite(db, user, contact, context.waitUntil, {
      notesForDynamicTags: input.notes ?? null,
      deriveInput:
        input.notes || input.email
          ? { notes: input.notes ?? "", email: input.email ?? null }
          : null,
    });
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
        strength: c.strength,
      };
    });

    const created = await db.insert(contacts).values(values).returning();

    const initialDelayHours = await getPreferenceValue(
      db,
      user.id,
      PrefKey.MemRepInitialDelayHours,
    );

    for (const contact of created) {
      context.waitUntil(
        generateRepsForNewContact(db, user.id, contact.id, initialDelayHours),
      );
    }
    context.waitUntil(meilisearchService.indexContacts(created));

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
      strength: fivePointScaleSchema.optional(),
      tags: z.array(z.string()).optional(),
      links: z.array(ContactLinkInputSchema).optional(),
    }),
  )
  .output(ContactOutputSchema)
  .handler(async ({ input, context }) => {
    const { db, user } = context;
    const { id, tags: inputTags, links: inputLinks, ...patch } = input;
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

    if (inputLinks !== undefined) {
      await replaceContactLinks(db, contact.id, inputLinks);
    }

    const existingPlainNotes =
      contact.notes && !contact.notesEncrypted ? contact.notes : null;

    return finalizeContactWrite(db, user, contact, context.waitUntil, {
      notesForDynamicTags:
        patch.notes !== undefined ? (input.notes ?? "") : null,
      deriveInput:
        patch.notes !== undefined || patch.email !== undefined
          ? {
              notes: input.notes ?? existingPlainNotes ?? "",
              email: contact.email ?? null,
            }
          : null,
    });
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

    context.waitUntil(meilisearchService.deleteContact(input.id));
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
 * Reindex the current user's active contacts into Meilisearch. Backfills contacts
 * created while indexing was unavailable. No-op when search isn't configured.
 */
export const reindexContacts = authProc
  .route({
    method: "POST",
    path: "/contacts/reindex",
    summary: "Reindex the current user's contacts into search",
    operationId: "reindexContacts",
  })
  .output(z.object({ reindexed: z.number() }))
  .handler(async ({ context }) => {
    const { db, user } = context;
    if (!isMeilisearchConfigured()) {
      return { reindexed: 0 };
    }

    const rows = await db
      .select()
      .from(contacts)
      .where(eq(contacts.userId, user.id));
    if (rows.length === 0) return { reindexed: 0 };

    // Tag names for all of the user's contacts in a single query.
    const tagRows = await db
      .select()
      .from(contactTags)
      .innerJoin(tagsTable, eq(tagsTable.id, contactTags.tagId))
      .where(eq(tagsTable.userId, user.id));
    const tagsByContact = new Map<string, string[]>();
    for (const row of tagRows) {
      const contactId = row.contact_tags.contactId;
      const list = tagsByContact.get(contactId) ?? [];
      list.push(row.tags.name);
      tagsByContact.set(contactId, list);
    }

    const items = rows.map((contact) => ({
      contact,
      tags: tagsByContact.get(contact.id) ?? [],
    }));

    // Awaited (not fire-and-forget) so the caller learns if indexing failed.
    await meilisearchService.indexContactBatch(items);
    return { reindexed: items.length };
  });

/**
 * Source for a merge, consumed by {@link applyMergeIntoDestination}. It is a
 * `Contact` row — the shape `mergeContact` selects out of `contacts` — with
 * every column optional (`Partial`), so the inline `mergeNewContact` source (a
 * not-yet-persisted contact with no `id`, `userId`, or timestamps) fits the same
 * type. `notes` must be **plaintext**; it is encrypted here before being
 * written. `links` aren't columns on the row, so they ride alongside.
 * `staticTagNames`, also not a column, is supplied only by the id-based merge —
 * the inline merge doesn't carry tags over.
 */
type MergeSource = Partial<Contact> & {
  staticTagNames?: string[]; // non-dynamic tag names; omitted by the inline merge
  links?: Array<{
    type: (typeof SOCIAL_LINK_TYPES)[number];
    value: string;
    label?: string | null;
  }>;
};

/**
 * Apply a merge source onto an already-fetched, ownership-checked destination
 * contact: fill empty scalar fields, merge static tags and links additively,
 * then run the shared write tail. This is the single source of truth for merge
 * semantics — `mergeContact` and `mergeNewContact` differ only in how they build
 * the `source` and what cleanup (source delete, directory re-point) they do
 * around this call.
 *
 * `enrichNewNotes` controls the write tail: when the source's notes are written
 * (i.e. the destination had none), pass `true` to regenerate dynamic tags and
 * derive fields/relationships from them, exactly as `createContact` does. The
 * id-based merge passes `false` — it isn't introducing genuinely new notes, so
 * re-processing them as if fresh would be incorrect.
 *
 * Writes stay sequential (no `db.transaction()`): D1 rejects Drizzle's
 * interactive transactions, and the destination is the only row mutated here, so
 * a partial failure leaves it valid and the operation is safe to retry.
 */
async function applyMergeIntoDestination(
  db: DatabaseClient,
  user: User,
  waitUntil: WaitUntil,
  destination: Contact,
  source: MergeSource,
  enrichNewNotes: boolean,
): Promise<z.input<typeof ContactOutputSchema>> {
  const destDecrypted = decryptContact(destination, user.id);
  const [destTags, destLinks] = await Promise.all([
    fetchContactTags(db, user.id, destination.id),
    fetchContactLinks(db, destination.id),
  ]);

  // Build patch: copy source fields only where destination is empty.
  const patch: Partial<NewContact> & { notesEncrypted?: boolean } = {};

  for (const field of [
    "email",
    "phone",
    "avatarUrl",
    "jobTitle",
    "company",
    "birthday",
  ] as const) {
    if (!destDecrypted[field] && source[field]) {
      (patch as any)[field] = source[field];
    }
  }
  // group handled separately to preserve its enum type
  if (!destDecrypted.group && source.group) {
    patch.group = source.group;
  }

  // Relationship strength: 0 (neutral) is the "unrated" sentinel, so the
  // copy-if-empty loop above can't be used (it treats 0 as a real value).
  // Adopt the source's rating only when the source has a real (non-zero)
  // strength and the destination is still unrated (0 or null).
  const srcStrength = source.strength ?? 0;
  const destStrength = destDecrypted.strength ?? 0;
  if (srcStrength !== 0 && destStrength === 0) {
    patch.strength = srcStrength;
  }

  // Notes are only adopted when the destination has none of its own.
  const newNotes = destDecrypted.notes ? null : (source.notes ?? null);
  if (newNotes) {
    const { notes: encNotes, notesEncrypted } = encryptNotes(newNotes, user.id);
    patch.notes = encNotes ?? null;
    patch.notesEncrypted = notesEncrypted;
  }

  const srcLastInteractionAt = source.lastInteractionAt;
  if (
    srcLastInteractionAt &&
    (!destination.lastInteractionAt ||
      srcLastInteractionAt > destination.lastInteractionAt)
  ) {
    patch.lastInteractionAt = srcLastInteractionAt;
  }

  // Compute tag/link changes against the destination's current state.
  const destTagNames = new Set(destTags.map((t) => t.name));
  const newTagNames = (source.staticTagNames ?? []).filter(
    (n) => !destTagNames.has(n),
  );
  const mergedStaticTagNames =
    newTagNames.length > 0
      ? [
          ...destTags.filter((t) => !t.isDynamic).map((t) => t.name),
          ...newTagNames,
        ]
      : null;

  const destLinkKeys = new Set(destLinks.map((l) => `${l.type}:${l.value}`));
  const newLinks = (source.links ?? []).filter(
    (l) => !destLinkKeys.has(`${l.type}:${l.value}`),
  );

  let updatedDest = destination;
  if (Object.keys(patch).length > 0) {
    const [updated] = await db
      .update(contacts)
      .set({ ...patch, updatedAt: new Date() } as Partial<NewContact>)
      .where(
        and(
          eq(contacts.id, destination.id) as SQL,
          eq(contacts.userId, user.id) as SQL,
        ),
      )
      .returning();
    updatedDest = updated ?? destination;
  }

  if (mergedStaticTagNames) {
    await replaceStaticTags(db, user.id, destination.id, mergedStaticTagNames);
  }

  if (newLinks.length > 0) {
    await db
      .insert(contactChannels)
      .values(
        newLinks.map((l) => ({
          contactId: destination.id,
          type: l.type,
          value: l.value,
          label: l.label ?? null,
        })),
      )
      .onConflictDoNothing();
  }

  // Enrich only the notes we actually wrote, using the post-merge email.
  const finalizeOpts =
    enrichNewNotes && newNotes
      ? {
          notesForDynamicTags: newNotes,
          deriveInput: { notes: newNotes, email: updatedDest.email ?? null },
        }
      : { notesForDynamicTags: null, deriveInput: null };

  return finalizeContactWrite(db, user, updatedDest, waitUntil, finalizeOpts);
}

/**
 * Merge source contact into destination contact.
 * Destination inherits each scalar field from source only where destination's
 * own value is null/empty. Tags and links are merged additively. Source is
 * deleted after the merge; directory entries pointing to source are re-pointed
 * to destination so they remain promoted.
 */
export const mergeContact = authProc
  .route({
    method: "POST",
    path: "/contacts/{destinationId}/merge",
    summary: "Merge source contact into destination contact",
    operationId: "mergeContact",
  })
  .input(
    z.object({
      destinationId: base58IdSchema,
      sourceId: base58IdSchema,
    }),
  )
  .output(ContactOutputSchema)
  .handler(async ({ input, context }) => {
    const { db, user } = context;

    if (input.destinationId === input.sourceId) {
      throw new ORPCError("BAD_REQUEST", {
        message: "Cannot merge a contact with itself",
      });
    }

    // Read both contacts and the source's tags/links upfront in parallel; the
    // destination's tags/links are fetched inside applyMergeIntoDestination.
    const [destination, source, srcTags, srcLinks] = await Promise.all([
      db
        .select()
        .from(contacts)
        .where(
          and(
            eq(contacts.id, input.destinationId) as SQL,
            eq(contacts.userId, user.id) as SQL,
          ),
        )
        .then((r) => r[0]),
      db
        .select()
        .from(contacts)
        .where(
          and(
            eq(contacts.id, input.sourceId) as SQL,
            eq(contacts.userId, user.id) as SQL,
          ),
        )
        .then((r) => r[0]),
      fetchContactTags(db, user.id, input.sourceId),
      fetchContactLinks(db, input.sourceId),
    ]);

    if (!destination) {
      throw new ORPCError("NOT_FOUND", {
        message: "Destination contact not found",
      });
    }
    if (!source) {
      throw new ORPCError("NOT_FOUND", { message: "Source contact not found" });
    }

    const srcDecrypted = decryptContact(source, user.id);

    // Populate the destination from the existing source contact. Skip field
    // derivation and relationship extraction — we're not writing new notes, so
    // re-processing them as if they were fresh would be incorrect.
    const result = await applyMergeIntoDestination(
      db,
      user,
      context.waitUntil,
      destination,
      {
        // The decrypted source row is already a `Contact`; spread it straight
        // in. Its non-dynamic tags and social links ride alongside.
        ...srcDecrypted,
        staticTagNames: srcTags.filter((t) => !t.isDynamic).map((t) => t.name),
        links: srcLinks,
      },
      false, // existing source: don't re-process its notes as fresh
    );

    // The destination is now fully populated; tear down the source. Re-point
    // directory promoted-pointer entries to the destination first so the
    // delete's ON DELETE SET NULL doesn't strand them, then delete the source
    // (cascade removes its tags/channels rows).
    await db
      .update(directory)
      .set({ activeContactId: destination.id })
      .where(eq(directory.activeContactId, source.id) as SQL);

    await db
      .delete(contacts)
      .where(
        and(
          eq(contacts.id, source.id) as SQL,
          eq(contacts.userId, user.id) as SQL,
        ),
      );

    context.waitUntil(meilisearchService.deleteContact(source.id));

    return result;
  });

/**
 * Source payload for `mergeNewContact`: like a created contact, but `name` is
 * optional (a merge never overwrites the destination's name) and `tags` are
 * dropped (an inline merge doesn't carry tags over to the destination).
 */
const MergeSourceSchema = ContactInputSchema.omit({ tags: true }).extend({
  name: z.string().min(1).optional(),
});

/**
 * Merge an inline (not-yet-persisted) contact into an existing destination
 * contact. Behaves like `mergeContact` but the source is supplied as a request
 * payload rather than an existing row — so nothing is created or deleted, and
 * there is no source contact to re-point the directory at. Lets a client merge
 * freshly-captured data (share/intent/image) into a managed contact in one call
 * instead of create-then-merge-then-delete.
 */
export const mergeNewContact = authProc
  .route({
    method: "POST",
    path: "/contacts/{destinationId}/merge-new",
    summary:
      "Merge an inline (non-persisted) contact into a destination contact",
    operationId: "mergeNewContact",
  })
  .input(
    z.object({
      destinationId: base58IdSchema,
      source: MergeSourceSchema,
    }),
  )
  .output(ContactOutputSchema)
  .handler(async ({ input, context }) => {
    const { db, user } = context;
    const { source: src } = input;

    const [destination] = await db
      .select()
      .from(contacts)
      .where(
        and(
          eq(contacts.id, input.destinationId) as SQL,
          eq(contacts.userId, user.id) as SQL,
        ),
      );

    if (!destination) {
      throw new ORPCError("NOT_FOUND", {
        message: "Destination contact not found",
      });
    }

    // Inline source: notes adopted by the destination are genuinely new to it,
    // so enrich them (dynamic tags + field/relationship derivation) exactly as
    // createContact would — this endpoint replaces a create-then-merge flow.
    return applyMergeIntoDestination(
      db,
      user,
      context.waitUntil,
      destination,
      {
        // A partial `Contact` built from the request payload — no id/userId/
        // timestamps, since this source was never persisted. Tags aren't carried
        // over for an inline merge; links are.
        email: src.email,
        phone: src.phone,
        avatarUrl: src.avatarUrl,
        jobTitle: src.jobTitle,
        company: src.company,
        birthday: src.birthday,
        group: (src.group as "work" | "personal" | undefined) ?? null,
        notes: src.notes ?? null,
        strength: src.strength,
        links: src.links ?? [],
      },
      true, // adopted notes are new to the destination → enrich them
    );
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
  merge: mergeContact,
  mergeNew: mergeNewContact,
  search: searchContacts,
  reindex: reindexContacts,
  listAvailable,
  searchAvailable,
  import: importContacts,
  getAvatarUploadUrl,
  extractFromImage,
};

export default router;
