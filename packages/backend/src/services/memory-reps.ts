import { eq, and, isNull, desc, inArray } from "drizzle-orm";
import { AxGen, f } from "@ax-llm/ax";
import type { DatabaseClient } from "../database/client";
import { contacts, memoryReps } from "../database/schema";
import type { Contact } from "../database/schema/contacts";
import { shuffle } from "es-toolkit";
import { getAI } from "./llm";

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
  .output("questions", QuestionSchema.array("1-3 questions per contact"))
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
 * Picks recent contacts that have no unanswered reps.
 */
async function selectEligibleContacts(
  db: DatabaseClient,
  userId: string,
  limit: number,
): Promise<Contact[]> {
  // Left join contacts with unanswered reps, keep only contacts with no match
  const results = await db
    .select()
    .from(contacts)
    .leftJoin(
      memoryReps,
      and(eq(memoryReps.contactId, contacts.id), isNull(memoryReps.answeredAt)),
    )
    .where(
      and(
        eq(contacts.userId, userId),
        isNull(memoryReps.id), // no unanswered reps
      ),
    )
    .orderBy(desc(contacts.createdAt))
    .limit(limit);

  return results.map((r) => r.contacts);
}

/**
 * Generate deterministic "Who is this person?" identify questions.
 * Requires >= 4 eligible contacts so we can build 4-option multiple choice.
 */
function generateIdentifyQuestions(
  eligibleContacts: Contact[],
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
  const withAvatar = eligibleContacts.filter((c) => c.avatarUrl);
  if (withAvatar.length === 0 || eligibleContacts.length < 4) return [];

  return withAvatar.map((contact) => {
    // Pick 3 random wrong names from other contacts
    const otherNames = eligibleContacts
      .filter((c) => c.id !== contact.id)
      .map((c) => c.name);
    const wrongNames = shuffle([...otherNames]).slice(0, 3);

    // Build options with correct answer at a random position
    const options = shuffle([...wrongNames, contact.name]);
    const correctAnswer = options.indexOf(contact.name);

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

  const validContactIds = new Set(eligibleContacts.map((c) => c.id));

  // Generate LLM-based detail questions
  const contactsWithNotes = eligibleContacts.filter((c) => c.notes);
  let detailInserts: Array<{
    userId: string;
    contactId: string;
    question: string;
    options: string[];
    correctAnswer: number;
    sourceField: string;
    questionType: string;
  }> = [];

  if (contactsWithNotes.length > 0) {
    const gen = new AxGen(quizSignature);
    const result: QuizResult = await gen.forward(getAI(), {
      contacts: contactsWithNotes.map((c) => ({
        contactId: c.id,
        name: c.name,
        notes: c.notes!,
      })),
    });

    detailInserts = result.questions
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

  // Generate deterministic identify questions
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
