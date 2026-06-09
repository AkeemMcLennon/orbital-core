import { eq, and } from "drizzle-orm";
import { AxGen, f } from "@ax-llm/ax";
import type { DatabaseClient } from "../database/client";
import { tags, contactTags } from "../database/schema";
import { getAI } from "./llm";
import { settings } from "../config";

export const CONSTANT_TAGS = ["Personal", "Professional", "Family"];

const tagSignature = f()
  .input(
    "notes",
    f.string("Notes about the contact and your relationship with them"),
  )
  .input(
    "email",
    f.string("Contact's email address, or empty string if unknown"),
  )
  .input(
    "availableTagNames",
    f.string(
      "Comma-separated list of all available tag names to reuse when applicable",
    ),
  )
  .output(
    "tags",
    f
      .string("A tag describing relationship context")
      .array(
        "1–5 tags — strongly prefer names from availableTagNames when they fit",
      ),
  )
  .description(
    "Analyze contact notes and generate tags that describe the RELATIONSHIP CONTEXT — " +
      "how or where the user knows this person, the setting they met, or why this person is relevant. " +
      "ALWAYS prefer tags from availableTagNames when semantically appropriate. " +
      "CRITICAL: When the notes mention a specific organization, company, event, or context that matches a name in availableTagNames, you MUST include that tag. " +
      "Good tags: 'Professional', 'Personal', 'Family', 'Investor', 'Customer', 'College Friend', 'Met at Conference'. " +
      "Avoid tags that merely describe what the contact does (e.g. 'Software Engineer') " +
      "unless that context is also why the user knows them.",
  )
  .build();

async function resolveTagIds(
  db: DatabaseClient,
  userId: string,
  names: string[],
): Promise<string[]> {
  if (names.length === 0) return [];

  const uniqueNames = [...new Set(names.map((n) => n.trim()).filter(Boolean))];
  const ids: string[] = [];
  for (const name of uniqueNames) {
    await db.insert(tags).values({ userId, name }).onConflictDoNothing();

    const [row] = await db
      .select()
      .from(tags)
      .where(and(eq(tags.userId, userId), eq(tags.name, name)))
      .limit(1);

    if (row) ids.push(row.id);
  }
  return ids;
}

export { resolveTagIds };

export async function assignStaticTags(
  db: DatabaseClient,
  userId: string,
  contactId: string,
  tagNames: string[],
): Promise<void> {
  if (tagNames.length === 0) return;
  const tagIds = await resolveTagIds(db, userId, tagNames);
  if (tagIds.length > 0) {
    await db
      .insert(contactTags)
      .values(tagIds.map((tagId) => ({ contactId, tagId, isDynamic: false })))
      .onConflictDoNothing();
  }
}

export async function replaceStaticTags(
  db: DatabaseClient,
  userId: string,
  contactId: string,
  tagNames: string[],
): Promise<void> {
  const tagIds = await resolveTagIds(db, userId, tagNames);
  await db
    .delete(contactTags)
    .where(
      and(
        eq(contactTags.contactId, contactId),
        eq(contactTags.isDynamic, false),
      ),
    );
  if (tagIds.length > 0) {
    await db
      .insert(contactTags)
      .values(tagIds.map((tagId) => ({ contactId, tagId, isDynamic: false })))
      .onConflictDoNothing();
  }
}

export async function fetchContactTags(
  db: DatabaseClient,
  userId: string,
  contactId: string,
): Promise<
  { id: string; name: string; color: string | null; isDynamic: boolean }[]
> {
  const rows = await db
    .select()
    .from(contactTags)
    .innerJoin(tags, eq(tags.id, contactTags.tagId))
    .where(and(eq(contactTags.contactId, contactId), eq(tags.userId, userId)));
  return rows.map((row) => ({
    id: row.tags.id,
    name: row.tags.name,
    color: row.tags.color,
    isDynamic: row.contact_tags.isDynamic,
  }));
}

export async function generateDynamicTagsForContact(
  db: DatabaseClient,
  userId: string,
  contactId: string,
  decryptedNotes: string,
  email?: string | null,
): Promise<void> {
  if (!decryptedNotes) return;
  if (
    !settings.LLM_BASE_URL ||
    !settings.LLM_API_KEY ||
    !settings.LLM_FAST_MODEL
  )
    return;

  try {
    const allTags = await db.select().from(tags).where(eq(tags.userId, userId));
    const availableTagNames = [
      ...CONSTANT_TAGS,
      ...allTags.map((t) => t.name),
    ].join(", ");

    const gen = new AxGen(tagSignature);
    const result = await gen.forward(getAI(), {
      notes: decryptedNotes,
      email: email ?? "",
      availableTagNames,
    });

    const rawTags = Array.isArray(result.tags)
      ? result.tags
      : typeof result.tags === "string"
        ? [result.tags]
        : [];

    const suggestedNames: string[] = rawTags
      .filter((t): t is string => typeof t === "string")
      .flatMap((t) => t.split(","))
      .map((t) => t.trim())
      .filter(Boolean);

    const tagIds = await resolveTagIds(db, userId, suggestedNames);

    await db
      .delete(contactTags)
      .where(
        and(
          eq(contactTags.contactId, contactId),
          eq(contactTags.isDynamic, true),
        ),
      );

    const existingStatic = await db
      .select()
      .from(contactTags)
      .where(eq(contactTags.contactId, contactId));

    const staticTagIds = new Set(existingStatic.map((r) => r.tagId));

    const toInsert = tagIds
      .filter((id) => !staticTagIds.has(id))
      .map((tagId) => ({ contactId, tagId, isDynamic: true }));

    if (toInsert.length > 0) {
      await db.insert(contactTags).values(toInsert);
    }
  } catch (err) {
    console.error("[tags] error:", err);
  }
}

const fieldSignature = f()
  .input("notes", f.string("Notes about the contact"))
  .input("email", f.string("Contact's email address, or empty string if unknown"))
  .output(
    "jobTitle",
    f.string("Job title or occupation, only if clearly stated in notes").optional(),
  )
  .output(
    "company",
    f
      .string(
        "Employer or company name — from notes if stated, or inferred from a recognizable email domain " +
          "(e.g. @stripe.com → 'Stripe'); omit for generic providers like gmail.com or outlook.com",
      )
      .optional(),
  )
  .output(
    "birthday",
    f
      .string("Birthday in YYYY-MM-DD or MM-DD format, only if explicitly mentioned")
      .optional(),
  )
  .description(
    "Extract structured contact fields from notes and email. " +
      "Only populate a field if confident — omit any field you are uncertain about.",
  )
  .build();

export async function deriveContactFields(
  decryptedNotes: string,
  email?: string | null,
): Promise<{ jobTitle?: string; company?: string; birthday?: string } | null> {
  if (!decryptedNotes && !email) return null;
  if (!settings.LLM_BASE_URL || !settings.LLM_API_KEY || !settings.LLM_FAST_MODEL)
    return null;

  try {
    const gen = new AxGen(fieldSignature);
    const result = await gen.forward(getAI(), {
      notes: decryptedNotes,
      email: email ?? "",
    });

    const derived: { jobTitle?: string; company?: string; birthday?: string } = {};
    if (typeof result.jobTitle === "string" && result.jobTitle.length > 0)
      derived.jobTitle = result.jobTitle;
    if (typeof result.company === "string" && result.company.length > 0)
      derived.company = result.company;
    if (
      typeof result.birthday === "string" &&
      /^(\d{4}-\d{2}-\d{2}|\d{2}-\d{2})$/.test(result.birthday)
    )
      derived.birthday = result.birthday;

    return Object.keys(derived).length > 0 ? derived : null;
  } catch (err) {
    console.error("[fields] error:", err);
    return null;
  }
}
