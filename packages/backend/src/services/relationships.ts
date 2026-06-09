import { eq, and, inArray, like, ne } from "drizzle-orm";
import { AxGen, f } from "@ax-llm/ax";
import type { DatabaseClient } from "../database/client";
import { contacts, contactRelationships } from "../database/schema";
import { getAI } from "./llm";
import { settings } from "../config";

const relationshipSignature = f()
  .input("notes", f.string("Notes about the contact and your relationship with them"))
  .input("contactName", f.string("Name of the contact whose notes are being analyzed"))
  .output(
    "mentions",
    f
      .string("Name of a person mentioned in the notes")
      .array("People mentioned in the notes who appear to be distinct contacts the user knows")
      .optional(),
  )
  .output(
    "types",
    f
      .string(
        "Relationship type between the contact and the mentioned person (e.g. 'colleague', 'friend', 'investor', 'referred by')",
      )
      .array("Relationship type for each entry in mentions — must be same length as mentions")
      .optional(),
  )
  .output(
    "descriptions",
    f
      .string("Short description of the connection (1 sentence max)")
      .array("Description for each entry in mentions — must be same length as mentions")
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
  if (!settings.LLM_BASE_URL || !settings.LLM_API_KEY || !settings.LLM_FAST_MODEL) return;

  try {
    const gen = new AxGen(relationshipSignature);
    const result = await gen.forward(getAI(), {
      notes: decryptedNotes,
      contactName,
    });

    const mentions = Array.isArray(result.mentions)
      ? (result.mentions as string[]).filter((m): m is string => typeof m === "string")
      : [];

    if (mentions.length === 0) return;

    const types = Array.isArray(result.types) ? (result.types as string[]) : [];
    const descriptions = Array.isArray(result.descriptions)
      ? (result.descriptions as string[])
      : [];

    // Delete existing dynamic relationships and their mirrors for this contact
    const dynamicRows = await db
      .select()
      .from(contactRelationships)
      .where(
        and(
          eq(contactRelationships.userId, userId),
          eq(contactRelationships.contactId, contactId),
          eq(contactRelationships.isDynamic, true),
        ),
      );

    const mirrorIds = dynamicRows
      .map((r) => r.mirrorId)
      .filter((id): id is string => typeof id === "string");

    if (mirrorIds.length > 0) {
      await db
        .delete(contactRelationships)
        .where(inArray(contactRelationships.id, mirrorIds));
    }

    if (dynamicRows.length > 0) {
      await db
        .delete(contactRelationships)
        .where(
          and(
            eq(contactRelationships.userId, userId),
            eq(contactRelationships.contactId, contactId),
            eq(contactRelationships.isDynamic, true),
          ),
        );
    }

    // Match each mentioned name to an existing contact and insert relationship pairs
    for (let i = 0; i < mentions.length; i++) {
      const name = mentions[i];
      const type = types[i] ?? "related";
      const description = descriptions[i] ?? null;

      const [matched] = await db
        .select()
        .from(contacts)
        .where(
          and(
            eq(contacts.userId, userId),
            like(contacts.name, name),
            ne(contacts.id, contactId),
          ),
        )
        .limit(1);

      if (!matched) continue;

      // Insert forward row (A→B)
      const [forwardRow] = await db
        .insert(contactRelationships)
        .values({
          userId,
          contactId,
          relatedContactId: matched.id,
          type,
          description: typeof description === "string" ? description : null,
          isDynamic: true,
        })
        .onConflictDoNothing()
        .returning();

      if (!forwardRow) continue;

      // Insert reverse row (B→A)
      const [reverseRow] = await db
        .insert(contactRelationships)
        .values({
          userId,
          contactId: matched.id,
          relatedContactId: contactId,
          type,
          description: typeof description === "string" ? description : null,
          isDynamic: true,
          mirrorId: forwardRow.id,
        })
        .onConflictDoNothing()
        .returning();

      if (!reverseRow) continue;

      // Update the forward row with the mirror ID
      await db
        .update(contactRelationships)
        .set({ mirrorId: reverseRow.id })
        .where(eq(contactRelationships.id, forwardRow.id));
    }
  } catch (err) {
    console.error("[relationships] error:", err);
  }
}
