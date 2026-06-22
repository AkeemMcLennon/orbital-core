import { eq, and, inArray } from "drizzle-orm";
import { AxGen, f } from "@ax-llm/ax";
import type { DatabaseClient } from "../database/client";
import { tags, contactTags, contacts } from "../database/schema";
import { getAI } from "./llm";
import { settings } from "../config";
import { crypto } from "../utils/crypto";

export const CONSTANT_TAGS = ["Personal", "Professional", "Family"];

const tagSignature = f()
  .input(
    "notes",
    f.string("Notes about the contact and your relationship with them"),
  )
  .input("email", f.string("Contact's email address, if known").optional())
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
  // Verify the contact belongs to this user before mutating
  const [owned] = await db
    .select()
    .from(contacts)
    .where(and(eq(contacts.id, contactId), eq(contacts.userId, userId)))
    .limit(1);
  if (!owned) return;

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
      ...(email ? { email } : {}),
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

    // Verify contact ownership before mutating
    const [owned] = await db
      .select()
      .from(contacts)
      .where(and(eq(contacts.id, contactId), eq(contacts.userId, userId)))
      .limit(1);
    if (!owned) return;

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
  .input("email", f.string("Contact's email address, if known").optional())
  .output(
    "jobTitle",
    f
      .string("Job title or occupation, only if clearly stated in notes")
      .optional(),
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
      .string(
        "Birthday in YYYY-MM-DD or MM-DD format, only if explicitly mentioned",
      )
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
  if (
    !settings.LLM_BASE_URL ||
    !settings.LLM_API_KEY ||
    !settings.LLM_FAST_MODEL
  )
    return null;

  try {
    const gen = new AxGen(fieldSignature);
    const result = await gen.forward(getAI(), {
      notes: decryptedNotes,
      ...(email ? { email } : {}),
    });

    const derived: { jobTitle?: string; company?: string; birthday?: string } =
      {};
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

export type NotedContact = { id: string; notes: string };

// Cloudflare D1 caps bound parameters per query (~100). Keep batches under it:
// inArray binds one param per id; contact_tags inserts bind three columns/row.
const ID_BATCH = 90;
const ROW_BATCH = 30;

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size)
    out.push(items.slice(i, i + size));
  return out;
}

/**
 * Decrypt a contact's notes, tolerating a single corrupt/undecryptable row
 * (logged and skipped) so one bad note can't abort a whole user's batch.
 */
function decryptNotes(
  c: { id: string; notes: string | null; notesEncrypted: boolean },
  userId: string,
): string | null {
  if (!c.notes) return null;
  if (!c.notesEncrypted) return c.notes;
  try {
    return crypto.decrypt(c.notes, userId);
  } catch (err) {
    console.error("[tag-discovery] note decrypt failed:", c.id, err);
    return null;
  }
}

/**
 * Load a user's contacts that have non-empty notes, decrypting once so the
 * discovery and assignment passes can share the result instead of each
 * re-reading and re-decrypting the whole table.
 */
export async function loadNotedContacts(
  db: DatabaseClient,
  userId: string,
): Promise<NotedContact[]> {
  const rows = await db
    .select()
    .from(contacts)
    .where(eq(contacts.userId, userId));

  const noted: NotedContact[] = [];
  for (const c of rows) {
    const notes = decryptNotes(c, userId);
    if (notes && notes.trim().length > 0) noted.push({ id: c.id, notes });
  }
  return noted;
}

/**
 * Pass 1 — discovery. Analyze the given set of notes in a single LLM call and
 * return candidate relationship-context tags that fit some or all contacts.
 * Purely in-memory: nothing is written to the database here. The returned names
 * are handed to {@link assignDiscoveredTagsToContacts}.
 */
const discoverTagsSignature = f()
  .input(
    "notes",
    f.string(
      "The full set of notes across many of the user's contacts, each note separated by a blank line",
    ),
  )
  .output(
    "tags",
    f
      .string("A tag describing relationship context")
      .array(
        "New tags describing relationship contexts shared by SOME OR ALL of the contacts",
      ),
  )
  .description(
    "Analyze the ENTIRE SET of contact notes and propose dynamic tags that describe the " +
      "RELATIONSHIP CONTEXT — how or where the user knows these people, shared settings, " +
      "communities, companies, events, or recurring themes that span SOME OR ALL contacts. " +
      "Strongly prefer tags that apply to MULTIPLE contacts. " +
      "Good tags: 'Professional', 'Personal', 'Family', 'Investor', 'College Friend', 'Met at Conference'. " +
      "Avoid tags that merely describe what one contact does (e.g. 'Software Engineer') " +
      "unless that context is also why the user knows them.",
  )
  .build();

export async function discoverDynamicTagsFromNotes(
  notes: string[],
): Promise<string[]> {
  if (notes.length === 0) return [];
  if (
    !settings.LLM_BASE_URL ||
    !settings.LLM_API_KEY ||
    !settings.LLM_FAST_MODEL
  )
    return [];

  try {
    const gen = new AxGen(discoverTagsSignature);
    const result = await gen.forward(getAI(), { notes: notes.join("\n\n") });

    const rawTags = Array.isArray(result.tags)
      ? result.tags
      : typeof result.tags === "string"
        ? [result.tags]
        : [];

    return [
      ...new Set(
        rawTags
          .filter((t): t is string => typeof t === "string")
          .flatMap((t) => t.split(","))
          .map((t) => t.trim())
          .filter(Boolean),
      ),
    ];
  } catch (err) {
    console.error("[tag-discovery] discover error:", err);
    return [];
  }
}

const assignTagsSignature = f()
  .input(
    "contactsBlock",
    f.string(
      "The user's contacts, one per line, formatted exactly as '[contactId] notes about the contact'",
    ),
  )
  .input(
    "availableTags",
    f.string(
      "Comma-separated list of the ONLY tag names you may assign — do not invent others",
    ),
  )
  .output(
    "assignments",
    f
      .string(
        "One contact's assignment formatted EXACTLY as 'contactId: tag1, tag2' — " +
          "the contactId copied verbatim from the input, a colon, then the comma-separated " +
          "tags (only names from availableTags) that fit that contact",
      )
      .array("One entry per contact that should receive at least one tag")
      .optional(),
  )
  .description(
    "For each contact, decide which of the availableTags genuinely describe the user's " +
      "RELATIONSHIP CONTEXT with that contact, based on their notes. " +
      "Only use names from availableTags — never invent new tags. " +
      "Return one entry per matching contact, each formatted 'contactId: tag1, tag2', " +
      "copying the contactId verbatim from the input. Keep each contactId together with its " +
      "own tags on the same line. Omit any contact that matches none of the availableTags.",
  )
  .build();

async function callAssignLLM(
  noted: NotedContact[],
  byId: Map<string, NotedContact>,
  candidateSet: Set<string>,
): Promise<{ contactId: string; names: string[] }[]> {
  const contactsBlock = noted
    .map((c) => `[${c.id}] ${c.notes.replace(/\s+/g, " ").trim()}`)
    .join("\n");

  const gen = new AxGen(assignTagsSignature);
  const result = await gen.forward(getAI(), {
    contactsBlock,
    availableTags: [...candidateSet].join(", "),
  });

  // Each entry couples an id with its tags ("contactId: tagA, tagB") so the two
  // can't desync the way separate parallel arrays did at scale. The model may
  // return one array element per contact OR collapse several into a single
  // newline-separated string — flatten both shapes, then parse each line.
  const rawAssignments = Array.isArray(result.assignments)
    ? (result.assignments as unknown[]).filter(
        (a): a is string => typeof a === "string",
      )
    : [];

  return rawAssignments
    .flatMap((a) => a.split("\n"))
    .map((line) => {
      const sep = line.indexOf(":");
      if (sep === -1) return null;
      const contactId = line
        .slice(0, sep)
        .trim()
        .replace(/^\[|\]$/g, "");
      if (!byId.has(contactId)) return null;
      const names = line
        .slice(sep + 1)
        .split(",")
        .map((t) => t.trim())
        .filter((t) => candidateSet.has(t));
      return names.length > 0 ? { contactId, names } : null;
    })
    .filter((p): p is { contactId: string; names: string[] } => p !== null);
}

/**
 * Pass 2 — assignment. Given candidate tags (pre-created by the caller),
 * makes a single LLM call mapping them onto contacts by id, then bulk-inserts
 * the matching junction rows. Augment-only: existing tags are never removed.
 * Returns the number of contacts that received at least one new tag.
 */
export async function assignDiscoveredTagsToContacts(
  db: DatabaseClient,
  userId: string,
  noted: NotedContact[],
  candidateTags: string[],
): Promise<number> {
  const candidateSet = new Set(
    candidateTags.map((t) => t.trim()).filter(Boolean),
  );
  if (candidateSet.size === 0 || noted.length === 0) return 0;
  if (
    !settings.LLM_BASE_URL ||
    !settings.LLM_API_KEY ||
    !settings.LLM_FAST_MODEL
  )
    return 0;

  try {
    // 1. LLM decides which candidates fit each contact.
    const byId = new Map(noted.map((c) => [c.id, c]));
    const parsed = await callAssignLLM(noted, byId, candidateSet);
    if (parsed.length === 0) return 0;

    // 2. Resolve candidate tag names → ids (tags exist — guaranteed by caller).
    const tagRows = await db
      .select()
      .from(tags)
      .where(and(eq(tags.userId, userId), inArray(tags.name, candidateTags)));
    const idByName = new Map(tagRows.map((t) => [t.name, t.id]));

    // 3. Map assignments → junction rows, deduping within this batch.
    const seen = new Set<string>();
    const rowsToInsert = parsed.flatMap(({ contactId, names }) =>
      names.flatMap((name) => {
        const tagId = idByName.get(name);
        if (!tagId) return [];
        const key = `${contactId}:${tagId}`;
        if (seen.has(key)) return [];
        seen.add(key);
        return [{ contactId, tagId, isDynamic: true as const }];
      }),
    );

    // 4. Insert in batches (3 params/row × ROW_BATCH=30 = 90, under D1 limit).
    //    onConflictDoNothing handles any rows already present.
    for (const batch of chunk(rowsToInsert, ROW_BATCH)) {
      await db.insert(contactTags).values(batch).onConflictDoNothing();
    }

    return new Set(rowsToInsert.map((r) => r.contactId)).size;
  } catch (err) {
    console.error("[tag-discovery] assign error:", err);
    return 0;
  }
}
