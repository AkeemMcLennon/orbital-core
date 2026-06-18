import { eq, and, ne } from "drizzle-orm";
import { AxGen, f } from "@ax-llm/ax";
import type { DatabaseClient } from "../database/client";
import { contacts, contactRelationships } from "../database/schema";
import { generateId } from "../database/custom-types";
import { bestMatch, toMatchCandidate } from "../utils/name-match";
import { getAI } from "./llm";
import { settings } from "../config";

const relationshipSignature = f()
  .input(
    "notes",
    f.string("Notes about the contact and your relationship with them"),
  )
  .input(
    "contactName",
    f.string("Name of the contact whose notes are being analyzed"),
  )
  .output(
    "mentions",
    f
      .string("Name of a person mentioned in the notes")
      .array(
        "People mentioned in the notes who appear to be distinct contacts the user knows",
      )
      .optional(),
  )
  .output(
    "types",
    f
      .string(
        "Relationship type between the contact and the mentioned person (e.g. 'colleague', 'friend', 'investor', 'referred by')",
      )
      .array(
        "Relationship type for each entry in mentions — must be same length as mentions",
      )
      .optional(),
  )
  .output(
    "descriptions",
    f
      .string("Short description of the connection (1 sentence max)")
      .array(
        "Description for each entry in mentions — must be same length as mentions",
      )
      .optional(),
  )
  .description(
    "Analyze contact notes to find mentions of other specific people the user knows. " +
      "Only extract names of real identifiable people (not vague references like 'a colleague'). " +
      "Return parallel arrays: mentions[i], types[i], and descriptions[i] describe the same relationship.",
  )
  .build();

export async function deriveContactRelationships(
  db: DatabaseClient,
  userId: string,
  contactId: string,
  contactName: string,
  decryptedNotes: string,
): Promise<void> {
  if (!decryptedNotes) return;
  if (
    !settings.LLM_BASE_URL ||
    !settings.LLM_API_KEY ||
    !settings.LLM_FAST_MODEL
  )
    return;

  try {
    const gen = new AxGen(relationshipSignature);
    const result = await gen.forward(getAI(), {
      notes: decryptedNotes,
      contactName,
    });

    const mentions = Array.isArray(result.mentions)
      ? (result.mentions as string[]).filter(
          (m): m is string => typeof m === "string",
        )
      : [];

    if (mentions.length === 0) return;

    const types = Array.isArray(result.types) ? (result.types as string[]) : [];
    const descriptions = Array.isArray(result.descriptions)
      ? (result.descriptions as string[])
      : [];

    // Load the user's other contacts and this contact's existing links once.
    const [userContacts, existingRows] = await Promise.all([
      db
        .select()
        .from(contacts)
        .where(and(eq(contacts.userId, userId), ne(contacts.id, contactId))),
      db
        .select()
        .from(contactRelationships)
        .where(
          and(
            eq(contactRelationships.userId, userId),
            eq(contactRelationships.contactId, contactId),
          ),
        ),
    ]);

    // Existing links are never overwritten (preserves static + avoids duplicates).
    // Forward-only check is sufficient: every create path inserts both directions.
    const alreadyRelated = new Set(existingRows.map((r) => r.relatedContactId));

    const candidates = userContacts.map((c) => toMatchCandidate(c.id, c.name));

    // Match each mentioned name to an existing contact and insert relationship pairs
    for (let i = 0; i < mentions.length; i++) {
      const matchedId = bestMatch(mentions[i], candidates);
      if (!matchedId || alreadyRelated.has(matchedId)) continue;

      const type = types[i] ?? "related";
      const description =
        typeof descriptions[i] === "string" ? descriptions[i] : null;
      const forwardId = generateId();
      const reverseId = generateId();

      try {
        // Single multi-row INSERT: atomic on D1 and bun:sqlite, mirrors pre-linked.
        await db.insert(contactRelationships).values([
          {
            id: forwardId,
            userId,
            contactId,
            relatedContactId: matchedId,
            type,
            description,
            isDynamic: true,
            mirrorId: reverseId,
          },
          {
            id: reverseId,
            userId,
            contactId: matchedId,
            relatedContactId: contactId,
            type,
            description,
            isDynamic: true,
            mirrorId: forwardId,
          },
        ]);
        alreadyRelated.add(matchedId); // dedupe repeated mentions in this run
      } catch (err) {
        // Unique-index race (pair created concurrently): skip, keep processing.
        console.error("[relationships] insert skipped:", err);
      }
    }
  } catch (err) {
    console.error("[relationships] error:", err);
  }
}
