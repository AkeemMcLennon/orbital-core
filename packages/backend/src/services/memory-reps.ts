import { eq, and, isNull, desc, inArray, gte } from "drizzle-orm";
import { AxGen, f } from "@ax-llm/ax";
import type { DatabaseClient } from "../database/client";
import { contacts, memoryReps } from "../database/schema";
import type { Contact } from "../database/schema/contacts";
import { shuffle } from "es-toolkit";
import {
  determineNameInfo,
  getNameByGender,
  parseNameParts,
} from "gender-name";
import { getAI } from "./llm";
import { getPreferenceValue, PrefKey } from "./preferences";
import { settings } from "../config";
import { crypto } from "../utils/crypto";

function decryptNotes<
  T extends { notes: string | null; notesEncrypted: boolean },
>(contact: T, userId: string): T {
  if (!contact.notesEncrypted || !contact.notes) return contact;
  return { ...contact, notes: crypto.decrypt(contact.notes, userId) };
}

const ContactSchema = f.object({
  contactId: f.string("Contact ID"),
  name: f.string("Contact name"),
  notes: f.string("Notes about the contact"),
});

const QuestionSchema = f.object({
  contactId: f.string(
    "Must match the exact input id used to derive this question",
  ),
  question: f.string("Trivia question about the contact"),
  options: f.string("Answer choice").array("Exactly 4 answer choices"),
  correctAnswer: f.number("0-based index into options").min(0).max(3),
  sourceField: f.string("Always 'notes'"),
});

interface QuizResult {
  questions: Array<{
    contactId: string;
    question: string;
    options: string[];
    correctAnswer: number;
    sourceField: string;
  }>;
}

const quizSignature = f()
  .input("contacts", ContactSchema.array("Contacts to generate questions for"))
  .output("questions", QuestionSchema.array("exactly 1 question per contact"))
  .description(
    "Generate multiple-choice trivia questions for each contact to help the user remember details about their contacts. Wrong options should be plausible but clearly different.",
  )
  .build();

interface GenerateResultItem {
  id: string;
  contactId: string;
  contactName: string;
  contactAvatarUrl: string | null;
  question: string;
  options: string[];
  correctAnswer: number;
  sourceField: string;
  questionType: string;
  scheduledFor: Date | null;
  answeredAt: Date | null;
  wasCorrect: boolean | null;
  createdAt: Date;
}

interface GenerateResult {
  generated: number;
  contactsUsed: number;
  items: GenerateResultItem[];
}

/**
 * Select contacts eligible for quiz generation.
 * Excludes contacts that have any rep created within the last 6 months.
 */
async function selectEligibleContacts(
  db: DatabaseClient,
  userId: string,
  limit: number,
): Promise<Contact[]> {
  // Exclude contacts that have any rep created within the last 6 months
  // (whether answered or not). This enforces a cooldown period.
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

  const results = await db
    .select()
    .from(contacts)
    .leftJoin(
      memoryReps,
      and(
        eq(memoryReps.contactId, contacts.id),
        gte(memoryReps.createdAt, sixMonthsAgo),
      ),
    )
    .where(
      and(
        eq(contacts.userId, userId),
        isNull(memoryReps.id), // no reps in the last 6 months
      ),
    )
    .orderBy(desc(contacts.createdAt))
    .limit(limit);

  return results.map((r) => r.contacts);
}

/**
 * Generate deterministic "Who is this person?" identify questions.
 * Uses the gender-name library to produce plausible wrong-answer names
 * matching the contact's gender and language origin.
 */
function generateIdentifyQuestions(
  questionContacts: Contact[],
  userId: string,
): Array<{
  userId: string;
  contactId: string;
  question: string;
  options: string[];
  correctAnswer: number;
  sourceField: string;
  questionType: string;
}> {
  const withAvatar = questionContacts.filter((c) => c.avatarUrl);
  if (withAvatar.length === 0) return [];

  return withAvatar.map((contact) => {
    // Use first name only so all options look consistent (wrong options are also first names)
    const firstName = parseNameParts(contact.name).firstName ?? contact.name;

    // Determine gender/language from contact's name for plausible distractors
    const nameInfo = determineNameInfo(contact.name);
    const gender = nameInfo?.gender;
    const language = nameInfo?.language;

    // Generate 3 unique wrong names using a Set to avoid duplicates
    const wrongNames = new Set<string>();

    // Try with matched gender/language first, then fall back to unconstrained
    const strategies: Array<[typeof gender, typeof language]> = [
      [gender, language],
      [gender, undefined],
      [undefined, undefined],
    ];

    for (const [g, l] of strategies) {
      for (let i = 0; i < 30 && wrongNames.size < 3; i++) {
        const name = getNameByGender(g, l);
        if (name && name !== firstName) wrongNames.add(name);
      }
      if (wrongNames.size >= 3) break;
    }

    // Build options with correct answer at a random position
    const options = shuffle([...wrongNames, firstName]);
    const correctAnswer = options.indexOf(firstName);

    return {
      userId,
      contactId: contact.id,
      question: "Who is this person?",
      options,
      correctAnswer,
      sourceField: "avatar",
      questionType: "identify",
    };
  });
}

interface RepInsert {
  userId: string;
  contactId: string;
  question: string;
  options: string[];
  correctAnswer: number;
  sourceField: string;
  questionType: string;
}

/**
 * Generate LLM-based detail questions for contacts that have notes.
 * Calls the LLM to produce trivia questions, shuffles options, and
 * filters results to only include valid contact IDs.
 */
async function generateDetailQuestions(
  contactsWithNotes: Contact[],
  userId: string,
): Promise<RepInsert[]> {
  if (contactsWithNotes.length === 0) return [];

  const validContactIds = new Set(contactsWithNotes.map((c) => c.id));

  const gen = new AxGen(quizSignature);
  const result: QuizResult = await gen.forward(getAI(), {
    contacts: contactsWithNotes.map((c) => ({
      contactId: c.id,
      name: c.name,
      notes: c.notes!,
    })),
  });

  return result.questions
    .filter((q) => validContactIds.has(q.contactId))
    .map((q) => {
      // Shuffle options since LLM tends to place correct answer at index 0
      const correctOption = q.options[q.correctAnswer];
      const shuffledOptions = shuffle([...q.options]);
      return {
        userId,
        contactId: q.contactId,
        question: q.question,
        options: shuffledOptions,
        correctAnswer: shuffledOptions.indexOf(correctOption),
        sourceField: q.sourceField,
        questionType: "detail",
      };
    });
}

/**
 * Generate memory rep questions for a user's contacts.
 */
export async function generateMemoryReps(
  db: DatabaseClient,
  userId: string,
  contactLimit: number = 10,
): Promise<GenerateResult> {
  const eligibleContacts = await selectEligibleContacts(
    db,
    userId,
    contactLimit,
  );

  if (eligibleContacts.length === 0) {
    return { generated: 0, contactsUsed: 0, items: [] };
  }

  // Every contact contributes to every pool it qualifies for, so notes + avatar
  // yields both a detail and an identify rep. The previous random split sent
  // each contact to exactly one pool, which starved identify reps whenever the
  // split landed badly — and could empty the identify pool entirely.
  const contactsWithNotes = eligibleContacts
    .map((c) => decryptNotes(c, userId))
    .filter((c) => c.notes);

  // Generate LLM-based detail questions
  const detailInserts = await generateDetailQuestions(
    contactsWithNotes,
    userId,
  );

  // Generate deterministic identify questions. Contacts without an avatar are
  // dropped inside generateIdentifyQuestions.
  const identifyInserts = generateIdentifyQuestions(eligibleContacts, userId);

  const toInsert = [...detailInserts, ...identifyInserts];

  if (toInsert.length === 0) {
    return { generated: 0, contactsUsed: 0, items: [] };
  }

  await db.insert(memoryReps).values(toInsert);

  const insertedContactIds = [...new Set(toInsert.map((r) => r.contactId))];

  // Query back inserted rows joined with contacts to get full shape
  const results = await db
    .select()
    .from(memoryReps)
    .innerJoin(contacts, eq(memoryReps.contactId, contacts.id))
    .where(
      and(
        eq(memoryReps.userId, userId),
        isNull(memoryReps.answeredAt),
        inArray(memoryReps.contactId, insertedContactIds),
      ),
    );

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
    generated: toInsert.length,
    contactsUsed: insertedContactIds.length,
    items,
  };
}

/**
 * Auto-generate memory reps when a new contact is created.
 * Always generates an identify question if the contact has an avatar.
 * Also generates a detail question via LLM if the contact has notes and LLM is configured.
 */
export async function generateRepsForNewContact(
  db: DatabaseClient,
  userId: string,
  contactId: string,
  initialDelayHours: number = 72,
): Promise<void> {
  const schedule = new Date(Date.now() + initialDelayHours * 3600000);

  // Fetch the newly created contact
  const [newContact] = await db
    .select()
    .from(contacts)
    .where(and(eq(contacts.id, contactId), eq(contacts.userId, userId)))
    .limit(1);

  if (!newContact) return;

  // Generate identify question using gender-name library for wrong options
  const identifyInserts = generateIdentifyQuestions([newContact], userId);

  // Generate detail question via LLM if contact has notes and LLM is configured
  let detailInserts: RepInsert[] = [];
  if (
    newContact.notes &&
    settings.LLM_BASE_URL &&
    settings.LLM_API_KEY &&
    settings.LLM_FAST_MODEL
  ) {
    try {
      detailInserts = await generateDetailQuestions(
        [decryptNotes(newContact, userId)],
        userId,
      );
    } catch (err) {
      // Silently skip LLM failures — identify question still gets inserted
      console.error("Failed to generate detail question for new contact:", err);
    }
  }

  const toInsert = [...identifyInserts, ...detailInserts].map((q) => ({
    ...q,
    scheduledFor: schedule,
  }));

  if (toInsert.length > 0) {
    await db.insert(memoryReps).values(toInsert);
  }
}

/**
 * Ensure a contact with an avatar has an identify ("Who is this person?") rep.
 *
 * Contacts created from a local photo (camera, gallery, vCard, device import)
 * are inserted with avatarUrl = null and only receive one on a later
 * updateContact, once the background upload finishes — so creation-time
 * generation cannot produce their identify rep. This is the catch-up path.
 *
 * Idempotent: a contact only ever gets one identify rep from here, so
 * replacing an avatar doesn't pile up reps. Two *concurrent* avatarUrl writes
 * could still both pass the existence check and double-insert; the client
 * uploads sequentially so this isn't reachable in practice, and closing it
 * properly needs a partial unique index (migration) rather than a wider read.
 *
 * TODO: notes have the symmetric gap — adding notes to an existing contact
 * never generates a detail rep, and the 6-month cooldown then hides it.
 */
export async function ensureIdentifyRep(
  db: DatabaseClient,
  contact: Contact,
): Promise<void> {
  if (!contact.avatarUrl) return;

  const [existing] = await db
    .select()
    .from(memoryReps)
    .where(
      and(
        eq(memoryReps.userId, contact.userId),
        eq(memoryReps.contactId, contact.id),
        eq(memoryReps.questionType, "identify"),
      ),
    )
    .limit(1);

  if (existing) return;

  // Looked up here rather than passed in: this whole call runs under
  // waitUntil, so the request path shouldn't pay for the query.
  const delayHours = await getPreferenceValue(
    db,
    contact.userId,
    PrefKey.MemRepInitialDelayHours,
  );
  const schedule = new Date(Date.now() + delayHours * 3600000);

  await db.insert(memoryReps).values(
    // Non-empty: the avatarUrl check above is the predicate this filters on.
    generateIdentifyQuestions([contact], contact.userId).map((q) => ({
      ...q,
      scheduledFor: schedule,
    })),
  );
}
