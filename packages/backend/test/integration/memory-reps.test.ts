import {
  getMemoryReps,
  generateMemoryReps,
  answerMemoryRep,
  createContact,
  updateContact,
  updatePreferences,
  initializeApiClient,
  getSuccessData,
} from "@orbital/client";
import { backend } from "@orbital/testing";
import { createTestToken } from "@orbital/testing/backend/auth";
import {
  axFieldContent,
  startMockLLMServer,
  type MockLLMServer,
} from "@orbital/testing/backend/llm";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from "bun:test";
import { crypto } from "../../src/utils/crypto";
import { parseNameParts } from "gender-name";
import { eq } from "drizzle-orm";
import { loadSettings } from "../../src/config";
import type { DatabaseClient } from "../../src/database/client";
import * as schema from "../../src/database/schema";
import { startServer } from "../../src/server";
import { resetLLMClient } from "../../src/services/llm";

type TestServer = backend.TestServer;

// Seed a contact with rich quizzable data
async function seedRichContact(
  db: DatabaseClient,
  userExternalId: string,
  data: {
    name: string;
    company?: string;
    jobTitle?: string;
    birthday?: string;
    notes?: string;
    group?: "work" | "personal";
    avatarUrl?: string;
  },
) {
  const [user] = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.externalId, userExternalId))
    .limit(1);

  if (!user) throw new Error(`User ${userExternalId} not found`);

  await db.insert(schema.contacts).values({
    userId: user.id,
    ...data,
  });
}

// ─── E2E Tests (real LLM) ───────────────────────────────────────────────

const HAS_LLM = !!(
  process.env.LLM_BASE_URL &&
  process.env.LLM_API_KEY &&
  process.env.LLM_FAST_MODEL
);

if (!HAS_LLM) {
  console.warn(
    "⚠ Memory Reps E2E skipped — set LLM_BASE_URL, LLM_API_KEY and LLM_FAST_MODEL to run against a real LLM",
  );
}

describe.skipIf(!HAS_LLM)("Memory Reps E2E (real LLM)", () => {
  let server: TestServer;
  let db: DatabaseClient;
  let token: string;

  beforeAll(async () => {
    db = await backend.createTestDatabase({
      schema,
      migrationsPath: "./src/database/migrations",
    });
    server = await backend.startTestServer({
      startServer,
      loadSettings,
      envOverrides: {
        LLM_BASE_URL: process.env.LLM_BASE_URL!,
        LLM_API_KEY: process.env.LLM_API_KEY!,
        LLM_FAST_MODEL: process.env.LLM_FAST_MODEL!,
      },
    });

    token = await createTestToken({
      sub: "llm-user",
      email: "llm@example.com",
    });

    initializeApiClient({
      baseURL: `${server.url}/rpc`,
      getToken: () => token,
    });
  });

  afterAll(() => {
    server.stop();
  });

  beforeEach(async () => {
    await backend.clearDatabase(db, { schema });
    await backend.seedTestUser(db, "llm-user", { schema });
  });

  it("should generate, list, and answer memory reps", async () => {
    // Seed 8 contacts with notes and avatars — enough that the random
    // detail/identify split reliably produces both question types
    await seedRichContact(db, "llm-user", {
      name: "Sarah Chen",
      company: "Acme Corp",
      jobTitle: "Product Manager",
      birthday: "1990-03-15",
      notes: "Met at React Conf 2024. Loves hiking.",
      group: "work",
      avatarUrl: "https://example.com/sarah.jpg",
    });

    await seedRichContact(db, "llm-user", {
      name: "Marcus Johnson",
      company: "Stripe",
      jobTitle: "Engineering Lead",
      notes: "Stanford CS grad. Plays guitar.",
      group: "work",
      avatarUrl: "https://example.com/marcus.jpg",
    });

    await seedRichContact(db, "llm-user", {
      name: "Emily Davis",
      notes: "Designer at Figma. Dog lover.",
      avatarUrl: "https://example.com/emily.jpg",
    });

    await seedRichContact(db, "llm-user", {
      name: "James Wilson",
      notes: "Runs a startup in fintech.",
      avatarUrl: "https://example.com/james.jpg",
    });

    await seedRichContact(db, "llm-user", {
      name: "Lisa Park",
      notes: "Marketing director at a health tech company.",
      avatarUrl: "https://example.com/lisa.jpg",
    });

    await seedRichContact(db, "llm-user", {
      name: "David Kim",
      notes: "Former colleague at TechCo. Enjoys rock climbing.",
      avatarUrl: "https://example.com/david.jpg",
    });

    await seedRichContact(db, "llm-user", {
      name: "Rachel Green",
      notes: "Met at a conference in NYC. Works in fashion.",
      avatarUrl: "https://example.com/rachel.jpg",
    });

    await seedRichContact(db, "llm-user", {
      name: "Tom Baker",
      notes: "College roommate. Now a lawyer in Chicago.",
      avatarUrl: "https://example.com/tom.jpg",
    });

    // Generate reps
    const genRes = await generateMemoryReps({});
    expect(genRes.status).toBe(200);
    const genData = getSuccessData(genRes);
    if (!genData) {
      throw new Error("Missing memory data");
    }
    expect(genData.generated).toBeGreaterThan(0);
    expect(genData.contactsUsed).toBeGreaterThan(0);
    expect(genData.items.length).toBeGreaterThan(0);
    expect(genData.items[0]).toHaveProperty("id");
    expect(genData.items[0]).toHaveProperty("contactName");
    expect(genData.items[0].options).toHaveLength(4);
    expect(genData.items[0]).toHaveProperty("questionType");
    expect(genData.items[0]).toHaveProperty("contactAvatarUrl");

    // Should have both detail and identify questions
    const detailItems = genData.items.filter(
      (i) => i.questionType === "detail",
    );
    const identifyItems = genData.items.filter(
      (i) => i.questionType === "identify",
    );
    expect(detailItems.length).toBeGreaterThan(0);
    expect(identifyItems.length).toBeGreaterThan(0);

    // Identify questions should have "Who is this person?"
    for (const item of identifyItems) {
      expect(item.question).toBe("Who is this person?");
      expect(item.contactAvatarUrl).toBeDefined();
    }

    // List reps
    const listRes = await getMemoryReps();
    expect(listRes.status).toBe(200);
    const listData = getSuccessData(listRes);
    console.log(listData);
    if (!listData) {
      throw new Error("Missing list data");
    }
    expect(listData.items.length).toBeGreaterThan(0);

    // Validate structure of first rep
    const rep = listData.items[0];
    expect(rep.id).toBeDefined();
    expect(rep.question).toBeDefined();
    expect(rep.options).toHaveLength(4);
    expect(rep.correctAnswer).toBeGreaterThanOrEqual(0);
    expect(rep.correctAnswer).toBeLessThanOrEqual(3);
    expect(rep.contactName).toBeDefined();
    expect(rep.sourceField).toBeDefined();
    expect(rep.answeredAt).toBeNull();

    // Answer a rep
    const answerRes = await answerMemoryRep(rep.id, {
      selectedAnswer: rep.correctAnswer,
    });
    expect(answerRes.status).toBe(200);
    const answerData = getSuccessData(answerRes) as any;
    expect(answerData.correct).toBe(true);
    expect(answerData.correctAnswer).toBe(rep.correctAnswer);
  }, 30000); // LLM calls can be slow

  it("gives a contact with both notes and an avatar a detail rep AND an identify rep", async () => {
    // A single contact is the sharpest case: a contact must contribute to
    // every pool it qualifies for, not be assigned to exactly one of them.
    await seedRichContact(db, "llm-user", {
      name: "Priya Raman",
      notes:
        "Met at Web Summit 2023. Runs marathons and roasts her own coffee.",
      avatarUrl: "https://example.com/priya.jpg",
    });

    const res = await generateMemoryReps({});
    expect(res.status).toBe(200);
    const data = getSuccessData(res)!;

    expect(data.contactsUsed).toBe(1);
    expect(data.items.map((i) => i.questionType).sort()).toEqual([
      "detail",
      "identify",
    ]);

    const identify = data.items.find((i) => i.questionType === "identify")!;
    expect(identify.question).toBe("Who is this person?");
    expect(identify.options[identify.correctAnswer]).toBe("Priya");
    expect(identify.contactAvatarUrl).toBe("https://example.com/priya.jpg");

    const detail = data.items.find((i) => i.questionType === "detail")!;
    expect(detail.options).toHaveLength(4);
    expect(detail.question).not.toBe("Who is this person?");
  }, 30000);
});

// ─── Unit Tests (no LLM) ────────────────────────────────────────────────

describe("Memory Reps API (unit)", () => {
  let server: TestServer;
  let db: DatabaseClient;
  let user1Token: string;
  let user2Token: string;

  beforeAll(async () => {
    db = await backend.createTestDatabase({
      schema,
      migrationsPath: "./src/database/migrations",
    });
    server = await backend.startTestServer({
      startServer,
      loadSettings,
    });

    user1Token = await createTestToken({
      sub: "user-1",
      email: "user1@example.com",
    });

    user2Token = await createTestToken({
      sub: "user-2",
      email: "user2@example.com",
    });

    initializeApiClient({
      baseURL: `${server.url}/rpc`,
      getToken: () => user1Token,
    });
  });

  afterAll(() => {
    server.stop();
  });

  beforeEach(async () => {
    await backend.clearDatabase(db, { schema });
    await backend.seedTestUser(db, "user-1", { schema });
    await backend.seedTestUser(db, "user-2", { schema });
  });

  // Helper to insert a contact and memory rep directly
  async function seedRepForUser(
    userExternalId: string,
    contactData: { name: string; company?: string },
    repData?: Partial<{
      question: string;
      options: string[];
      correctAnswer: number;
      sourceField: string;
    }>,
  ) {
    const [user] = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.externalId, userExternalId))
      .limit(1);
    if (!user) throw new Error(`User ${userExternalId} not found`);

    // Insert contact
    await db.insert(schema.contacts).values({
      userId: user.id,
      name: contactData.name,
      company: contactData.company,
    });

    const [contact] = await db
      .select()
      .from(schema.contacts)
      .where(eq(schema.contacts.userId, user.id))
      .limit(1);

    // Insert memory rep
    await db.insert(schema.memoryReps).values({
      userId: user.id,
      contactId: contact!.id,
      question: repData?.question ?? `Where does ${contactData.name} work?`,
      options: repData?.options ?? [
        contactData.company ?? "Unknown",
        "Google",
        "Meta",
        "Apple",
      ],
      correctAnswer: repData?.correctAnswer ?? 0,
      sourceField: repData?.sourceField ?? "company",
    });

    const [rep] = await db
      .select()
      .from(schema.memoryReps)
      .where(eq(schema.memoryReps.contactId, contact!.id))
      .limit(1);

    return { user, contact: contact!, rep: rep! };
  }

  describe("GET /rpc/memory-reps", () => {
    it("should list unanswered reps by default", async () => {
      await seedRepForUser("user-1", { name: "Alice", company: "Acme" });

      const response = await getMemoryReps();
      expect(response.status).toBe(200);

      const data = getSuccessData(response) as any;
      expect(data.items).toHaveLength(1);
      expect(data.items[0].question).toBe("Where does Alice work?");
      expect(data.items[0].contactName).toBe("Alice");
      expect(data.items[0].options).toEqual([
        "Acme",
        "Google",
        "Meta",
        "Apple",
      ]);
      expect(data.items[0].correctAnswer).toBe(0);
      expect(data.items[0].questionType).toBe("detail");
      expect(data.items[0].answeredAt).toBeNull();
      expect(data.pagination.total).toBe(1);
    });

    it("should not include answered reps by default", async () => {
      const { rep } = await seedRepForUser("user-1", {
        name: "Alice",
        company: "Acme",
      });

      // Mark as answered
      await db
        .update(schema.memoryReps)
        .set({ answeredAt: new Date(), wasCorrect: true })
        .where(eq(schema.memoryReps.id, rep.id));

      const response = await getMemoryReps();
      const data = getSuccessData(response) as any;
      expect(data.items).toHaveLength(0);
    });

    it("should include answered reps when includeAnswered=true", async () => {
      const { rep } = await seedRepForUser("user-1", {
        name: "Alice",
        company: "Acme",
      });

      await db
        .update(schema.memoryReps)
        .set({ answeredAt: new Date(), wasCorrect: false })
        .where(eq(schema.memoryReps.id, rep.id));

      const response = await getMemoryReps({ includeAnswered: true });
      const data = getSuccessData(response) as any;
      expect(data.items).toHaveLength(1);
      expect(data.items[0].wasCorrect).toBe(false);
    });

    it("should enforce multi-user isolation", async () => {
      await seedRepForUser("user-1", { name: "Alice", company: "Acme" });
      await seedRepForUser("user-2", { name: "Bob", company: "Stripe" });

      // User 1 should only see their rep
      const res1 = await getMemoryReps();
      const data1 = getSuccessData(res1) as any;
      expect(data1.items).toHaveLength(1);
      expect(data1.items[0].contactName).toBe("Alice");

      // Switch to user 2
      initializeApiClient({
        baseURL: `${server.url}/rpc`,
        getToken: () => user2Token,
      });

      const res2 = await getMemoryReps();
      const data2 = getSuccessData(res2) as any;
      expect(data2.items).toHaveLength(1);
      expect(data2.items[0].contactName).toBe("Bob");

      // Restore user 1
      initializeApiClient({
        baseURL: `${server.url}/rpc`,
        getToken: () => user1Token,
      });
    });
  });

  describe("POST /rpc/memory-reps/{id}/answer", () => {
    it("should record correct answer", async () => {
      const { rep } = await seedRepForUser("user-1", {
        name: "Alice",
        company: "Acme",
      });

      const response = await answerMemoryRep(rep.id, { selectedAnswer: 0 });
      expect(response.status).toBe(200);

      const data = getSuccessData(response) as any;
      expect(data.correct).toBe(true);
      expect(data.correctAnswer).toBe(0);
    });

    it("should record incorrect answer", async () => {
      const { rep } = await seedRepForUser("user-1", {
        name: "Alice",
        company: "Acme",
      });

      const response = await answerMemoryRep(rep.id, { selectedAnswer: 2 });
      expect(response.status).toBe(200);

      const data = getSuccessData(response) as any;
      expect(data.correct).toBe(false);
      expect(data.correctAnswer).toBe(0);
    });

    it("should reject double answer (409 Conflict)", async () => {
      const { rep } = await seedRepForUser("user-1", {
        name: "Alice",
        company: "Acme",
      });

      await answerMemoryRep(rep.id, { selectedAnswer: 0 });

      const res2 = await answerMemoryRep(rep.id, { selectedAnswer: 1 });
      expect(res2.status as number).toBe(409);
    });

    it("should not allow answering another user's rep", async () => {
      const { rep } = await seedRepForUser("user-1", {
        name: "Alice",
        company: "Acme",
      });

      // Switch to user 2
      initializeApiClient({
        baseURL: `${server.url}/rpc`,
        getToken: () => user2Token,
      });

      const response = await answerMemoryRep(rep.id, { selectedAnswer: 0 });
      expect(response.status).toBe(404);

      // Restore user 1
      initializeApiClient({
        baseURL: `${server.url}/rpc`,
        getToken: () => user1Token,
      });
    });
  });

  describe("POST /rpc/memory-reps/generate", () => {
    it("should return 400 when LLM not configured but contacts have notes", async () => {
      await seedRichContact(db, "user-1", {
        name: "Alice",
        notes: "Works at Acme Corp.",
      });

      // Any contact with notes reaches the LLM, so this is deterministic.
      const response = await generateMemoryReps({});
      expect(response.status).toBe(400);
    });

    it("should generate identify questions without LLM when contacts have avatars", async () => {
      // Seed contacts with avatars but no notes (no LLM call needed)
      for (const name of ["Alice", "Bob", "Charlie", "Diana"]) {
        await seedRichContact(db, "user-1", {
          name,
          avatarUrl: `https://example.com/${name.toLowerCase()}.jpg`,
        });
      }

      const response = await generateMemoryReps({});
      const data = getSuccessData(response);
      if (!data) throw new Error("No data");

      expect(data.generated).toBe(4);
      expect(data.items.every((i) => i.questionType === "identify")).toBe(true);
      expect(
        data.items.every((i) => i.question === "Who is this person?"),
      ).toBe(true);
      for (const item of data.items) {
        // Correct answer option is the contact's first name
        const expectedFirst =
          parseNameParts(item.contactName).firstName ?? item.contactName;
        expect(item.options[item.correctAnswer]).toBe(expectedFirst);
        // There are wrong answers that are NOT the correct answer
        const wrongOptions = item.options.filter((o) => o !== expectedFirst);
        expect(wrongOptions.length).toBeGreaterThan(0);
      }
    });

    it("should generate identify questions even with a single contact", async () => {
      // 1 contact with avatar — wrong options come from gender-name library
      await seedRichContact(db, "user-1", {
        name: "Alice",
        avatarUrl: "https://example.com/alice.jpg",
      });

      const response = await generateMemoryReps({});
      const data = getSuccessData(response);
      if (!data) throw new Error("No data");

      expect(data.generated).toBe(1);
      // Correct answer is within options
      expect(data.items[0].options[data.items[0].correctAnswer]).toBe("Alice");
      // There are wrong answers that are NOT the correct answer
      const wrongOptions = data.items[0].options.filter((o) => o !== "Alice");
      expect(wrongOptions.length).toBeGreaterThan(0);
    });

    it("should only generate identify questions for contacts with avatars", async () => {
      // 4 contacts but only 2 have avatars
      await seedRichContact(db, "user-1", {
        name: "Alice",
        avatarUrl: "https://example.com/a.jpg",
      });
      await seedRichContact(db, "user-1", {
        name: "Bob",
        avatarUrl: "https://example.com/b.jpg",
      });
      await seedRichContact(db, "user-1", { name: "Charlie" });
      await seedRichContact(db, "user-1", { name: "Diana" });

      const response = await generateMemoryReps({});
      const data = getSuccessData(response);
      if (!data) throw new Error("No data");

      // Should generate identify only for the 2 with avatars
      expect(data.items).toHaveLength(2);
      expect(data.items.every((i) => i.questionType === "identify")).toBe(true);
      expect(data.items.every((i) => i.contactAvatarUrl !== null)).toBe(true);
    });

    it("should include correct name in identify question options", async () => {
      for (const name of ["Alice", "Bob", "Charlie", "Diana"]) {
        await seedRichContact(db, "user-1", {
          name,
          avatarUrl: `https://example.com/${name.toLowerCase()}.jpg`,
        });
      }

      const response = await generateMemoryReps({});
      const data = getSuccessData(response);
      if (!data) throw new Error("No data");

      expect(data.items.length).toBeGreaterThan(0);
      for (const item of data.items) {
        // Correct answer option is the contact's first name
        const expectedFirst =
          parseNameParts(item.contactName).firstName ?? item.contactName;
        expect(item.options[item.correctAnswer]).toBe(expectedFirst);
        // All options should be non-empty strings
        for (const opt of item.options) {
          expect(typeof opt).toBe("string");
          expect(opt.length).toBeGreaterThan(0);
        }
        // There are wrong answers that are NOT the correct answer
        const wrongOptions = item.options.filter((o) => o !== expectedFirst);
        expect(wrongOptions.length).toBeGreaterThan(0);
      }
    });

    it("should generate, answer wrong, then answer correct", async () => {
      // Seed 4 contacts with avatars (generates identify questions without LLM)
      for (const name of ["Alice", "Bob", "Charlie", "Diana"]) {
        await seedRichContact(db, "user-1", {
          name,
          avatarUrl: `https://example.com/${name.toLowerCase()}.jpg`,
        });
      }

      const genRes = await generateMemoryReps({});
      const genData = getSuccessData(genRes);
      if (!genData) throw new Error("No data");
      expect(genData.items.length).toBeGreaterThanOrEqual(2);

      const [first, second] = genData.items;

      // Answer first question incorrectly
      const wrongIndex = (first.correctAnswer + 1) % 4;
      const wrongRes = await answerMemoryRep(first.id, {
        selectedAnswer: wrongIndex,
      });
      expect(wrongRes.status).toBe(200);
      const wrongData = getSuccessData(wrongRes)!;
      expect(wrongData.correct).toBe(false);
      expect(wrongData.correctAnswer).toBe(first.correctAnswer);

      // Answer second question correctly
      const rightRes = await answerMemoryRep(second.id, {
        selectedAnswer: second.correctAnswer,
      });
      expect(rightRes.status).toBe(200);
      const rightData = getSuccessData(rightRes)!;
      expect(rightData.correct).toBe(true);
      expect(rightData.correctAnswer).toBe(second.correctAnswer);

      // Verify answered reps are excluded from default list
      const listRes = await getMemoryReps();
      const listData = getSuccessData(listRes)!;
      const answeredIds = [first.id, second.id];
      for (const item of listData.items) {
        expect(answeredIds).not.toContain(item.id);
      }

      // Verify answered reps appear with includeAnswered=true
      const allRes = await getMemoryReps({ includeAnswered: true });
      const allData = getSuccessData(allRes)!;
      const answeredItems = allData.items.filter((i) =>
        answeredIds.includes(i.id),
      );
      expect(answeredItems).toHaveLength(2);

      const wrongItem = answeredItems.find((i) => i.id === first.id)!;
      expect(wrongItem.wasCorrect).toBe(false);
      expect(wrongItem.answeredAt).not.toBeNull();

      const rightItem = answeredItems.find((i) => i.id === second.id)!;
      expect(rightItem.wasCorrect).toBe(true);
      expect(rightItem.answeredAt).not.toBeNull();
    });

    it("should return 0 generated when no contacts exist", async () => {
      const response = await generateMemoryReps({});
      const data = getSuccessData(response);
      if (!data) {
        throw new Error("No data");
      }
      expect(data.generated).toBe(0);
      expect(data.contactsUsed).toBe(0);
      expect(data.items).toEqual([]);
    });
  });

  describe("Auto-generated reps on contact creation", () => {
    it("should auto-generate scheduled reps when creating a contact with avatar", async () => {
      // Create a contact via API (triggers auto-generation, no other contacts needed)
      const createRes = await createContact({
        name: "Diana",
        avatarUrl: "https://example.com/diana.jpg",
      });
      expect(createRes.status).toBe(200);

      // Wait briefly for background task to complete
      await new Promise((r) => setTimeout(r, 200));

      // Reps should be scheduled 3 days in the future, so NOT visible in listing
      const listRes = await getMemoryReps();
      const listData = getSuccessData(listRes) as any;
      const dianaReps = listData.items.filter(
        (i: any) => i.contactName === "Diana",
      );
      expect(dianaReps).toHaveLength(0);

      // Verify reps were actually created in DB
      const dbReps = await db
        .select()
        .from(schema.memoryReps)
        .where(
          eq(
            schema.memoryReps.userId,
            (
              await db
                .select()
                .from(schema.users)
                .where(eq(schema.users.externalId, "user-1"))
                .limit(1)
            )[0]!.id,
          ),
        );

      const scheduledReps = dbReps.filter((r) => r.scheduledFor !== null);
      expect(scheduledReps.length).toBeGreaterThan(0);

      // All scheduled reps should be ~72 hours (3 days) in the future (default delay)
      const seventyTwoHoursMs = 72 * 3600000;
      for (const rep of scheduledReps) {
        const diff = rep.scheduledFor!.getTime() - Date.now();
        expect(diff).toBeGreaterThan(seventyTwoHoursMs - 5000);
        expect(diff).toBeLessThan(seventyTwoHoursMs + 5000);
      }
    });

    it("should respect memRepInitialDelayHours preference when scheduling reps for a new contact", async () => {
      // Set preference to 0 hours so reps are immediately visible
      const prefRes = await updatePreferences({ memRepInitialDelayHours: 0 });
      expect(prefRes.status).toBe(200);

      // Create a contact with an avatar (triggers auto-generation of an identify question)
      const createRes = await createContact({
        name: "PrefTest Person",
        avatarUrl: "https://example.com/preftest.jpg",
      });
      expect(createRes.status).toBe(200);

      // Wait briefly for the background task to complete
      await new Promise((r) => setTimeout(r, 200));

      // With 0-hour delay, scheduledFor is now-or-past so reps should appear in the listing
      const listRes = await getMemoryReps();
      const listData = getSuccessData(listRes) as any;
      const prefTestReps = listData.items.filter(
        (i: any) => i.contactName === "PrefTest Person",
      );
      expect(prefTestReps.length).toBeGreaterThan(0);
    });

    it("should show past-scheduled reps in listing", async () => {
      // Seed a user and contact, then insert a rep with scheduledFor in the past
      const [user] = await db
        .select()
        .from(schema.users)
        .where(eq(schema.users.externalId, "user-1"))
        .limit(1);

      await db.insert(schema.contacts).values({
        userId: user!.id,
        name: "PastRep Person",
      });

      const [contact] = await db
        .select()
        .from(schema.contacts)
        .where(eq(schema.contacts.userId, user!.id))
        .limit(1);

      await db.insert(schema.memoryReps).values({
        userId: user!.id,
        contactId: contact!.id,
        question: "Test past scheduled?",
        options: ["A", "B", "C", "D"],
        correctAnswer: 0,
        sourceField: "notes",
        questionType: "detail",
        scheduledFor: new Date(Date.now() - 86400000), // 1 day ago
      });

      const listRes = await getMemoryReps();
      const listData = getSuccessData(listRes) as any;
      expect(listData.items.length).toBeGreaterThan(0);
      const pastRep = listData.items.find(
        (i: any) => i.question === "Test past scheduled?",
      );
      expect(pastRep).toBeDefined();
    });

    it("should not show future-scheduled reps in listing", async () => {
      const [user] = await db
        .select()
        .from(schema.users)
        .where(eq(schema.users.externalId, "user-1"))
        .limit(1);

      await db.insert(schema.contacts).values({
        userId: user!.id,
        name: "FutureRep Person",
      });

      const [contact] = await db
        .select()
        .from(schema.contacts)
        .where(eq(schema.contacts.userId, user!.id))
        .limit(1);

      await db.insert(schema.memoryReps).values({
        userId: user!.id,
        contactId: contact!.id,
        question: "Test future scheduled?",
        options: ["A", "B", "C", "D"],
        correctAnswer: 0,
        sourceField: "notes",
        questionType: "detail",
        scheduledFor: new Date(Date.now() + 7 * 86400000), // 7 days from now
      });

      const listRes = await getMemoryReps();
      const listData = getSuccessData(listRes) as any;
      const futureRep = listData.items.find(
        (i: any) => i.question === "Test future scheduled?",
      );
      expect(futureRep).toBeUndefined();
    });
  });

  // The mobile client creates the contact first and uploads a local photo
  // afterwards (createContactWithAvatar -> backgroundUploadAvatar ->
  // updateContact), so the row is born with avatarUrl = null and rep
  // generation only ran at creation time — these contacts never got a
  // "Who is this person?" rep.
  describe("Identify reps when the avatar arrives after creation", () => {
    async function repsFor(contactId: string) {
      return db
        .select()
        .from(schema.memoryReps)
        .where(eq(schema.memoryReps.contactId, contactId));
    }

    // Rep generation runs under waitUntil (fire-and-forget), so poll rather
    // than guessing a sleep duration; returns whatever it has at the deadline.
    async function waitForReps(
      contactId: string,
      done: (reps: Awaited<ReturnType<typeof repsFor>>) => boolean,
      timeoutMs = 3000,
    ) {
      const deadline = Date.now() + timeoutMs;
      for (;;) {
        const reps = await repsFor(contactId);
        if (done(reps) || Date.now() > deadline) return reps;
        await new Promise((r) => setTimeout(r, 50));
      }
    }

    it("creates an identify rep when the avatar is uploaded after the contact is created", async () => {
      // 1. Contact created with no avatar — the local photo hasn't uploaded yet.
      const createRes = await createContact({ name: "Nadia" });
      expect(createRes.status).toBe(200);
      const contact = getSuccessData(createRes)!;
      expect(contact.avatarUrl).toBeNull();

      // Creation-time generation cannot produce an identify rep here.
      await new Promise((r) => setTimeout(r, 200));
      const atCreate = await repsFor(contact.id);
      expect(
        atCreate.filter((r) => r.questionType === "identify"),
      ).toHaveLength(0);

      // 2. The background upload finishes and PUTs the public URL.
      const updateRes = await updateContact(contact.id, {
        avatarUrl: "https://cdn.example.com/avatars/nadia.jpg",
      });
      expect(updateRes.status).toBe(200);

      // 3. That must now produce the identify rep.
      const reps = await waitForReps(contact.id, (r) =>
        r.some((x) => x.questionType === "identify"),
      );
      const identify = reps.filter((r) => r.questionType === "identify");
      expect(identify).toHaveLength(1);
      expect(identify[0]!.question).toBe("Who is this person?");
      expect(identify[0]!.sourceField).toBe("avatar");
      expect(identify[0]!.options[identify[0]!.correctAnswer]).toBe("Nadia");
      expect(identify[0]!.scheduledFor).not.toBeNull();
    });

    it("surfaces the late-avatar identify rep through GET /memory-reps", async () => {
      // 0-hour delay so the rep is immediately listable.
      const prefRes = await updatePreferences({ memRepInitialDelayHours: 0 });
      expect(prefRes.status).toBe(200);

      const contact = getSuccessData(await createContact({ name: "Oskar" }))!;
      await updateContact(contact.id, {
        avatarUrl: "https://cdn.example.com/avatars/oskar.jpg",
      });
      await waitForReps(contact.id, (r) => r.length > 0);

      const listData = getSuccessData(await getMemoryReps())!;
      const items = listData.items.filter((i) => i.contactId === contact.id);
      expect(items).toHaveLength(1);
      expect(items[0]!.questionType).toBe("identify");
      expect(items[0]!.contactAvatarUrl).toBe(
        "https://cdn.example.com/avatars/oskar.jpg",
      );
    });

    it("does not create a second identify rep when the avatar is replaced", async () => {
      const contact = getSuccessData(await createContact({ name: "Priya" }))!;

      await updateContact(contact.id, {
        avatarUrl: "https://cdn.example.com/avatars/priya-1.jpg",
      });
      await waitForReps(contact.id, (r) => r.length > 0);

      await updateContact(contact.id, {
        avatarUrl: "https://cdn.example.com/avatars/priya-2.jpg",
      });
      await new Promise((r) => setTimeout(r, 300));

      const reps = await repsFor(contact.id);
      expect(reps.filter((r) => r.questionType === "identify")).toHaveLength(1);
    });

    it("creates exactly one identify rep when the contact is created with a remote avatar", async () => {
      // Google-imported contacts carry an https:// photo URL, so the avatar is
      // present at insert time and generateRepsForNewContact makes the rep.
      // It must stay the sole owner on this path — a second trigger here (e.g.
      // hanging ensureIdentifyRep off the shared write tail) would race it and
      // double-insert, since generateRepsForNewContact's insert is unguarded.
      const contact = getSuccessData(
        await createContact({
          name: "Quentin",
          avatarUrl: "https://cdn.example.com/avatars/quentin.jpg",
        }),
      )!;

      const reps = await waitForReps(contact.id, (r) => r.length > 0);
      expect(reps.filter((r) => r.questionType === "identify")).toHaveLength(1);
    });
  });
});

// ─── Encryption Tests ───────────────────────────────────────────────────────

describe("Memory Reps: notes decrypted before LLM", () => {
  let server: TestServer;
  let db: DatabaseClient;
  let mockLLM: MockLLMServer;
  let token: string;

  beforeAll(async () => {
    db = await backend.createTestDatabase({
      schema,
      migrationsPath: "./src/database/migrations",
    });
    // LLM calls run through the real AxGen pipeline against a local
    // mock OpenAI-compat server — the captured request bodies let us
    // assert what actually went over the wire.
    // DB_ENCRYPTION_KEY uses the standard test default so the shared crypto
    // singleton decrypts with the same key used to encrypt below.
    mockLLM = await startMockLLMServer();
    resetLLMClient(); // drop any AxAI client cached by earlier describe blocks
    server = await backend.startTestServer({
      startServer,
      loadSettings,
      envOverrides: {
        LLM_BASE_URL: mockLLM.url,
        LLM_API_KEY: "test-key",
        LLM_FAST_MODEL: "test-model",
      },
    });

    token = await createTestToken({
      sub: "enc-user",
      email: "enc@example.com",
    });
    initializeApiClient({
      baseURL: `${server.url}/rpc`,
      getToken: () => token,
    });
  });

  afterAll(() => {
    server.stop();
    mockLLM.stop();
    resetLLMClient();
  });

  beforeEach(async () => {
    mockLLM.reset();
    await backend.clearDatabase(db, { schema });
    await backend.seedTestUser(db, "enc-user", { schema });
  });

  it("passes plaintext notes to the LLM when notes are encrypted at rest", async () => {
    const PLAINTEXT_NOTES = "Met at React Conf. Loves hiking.";

    const [user] = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.externalId, "enc-user"))
      .limit(1);

    // Encrypt using the shared crypto singleton — same key the server uses to
    // decrypt, so no hardcoded key constant is needed.
    const encryptedNotes = crypto.encrypt(PLAINTEXT_NOTES, user!.id);

    await db.insert(schema.contacts).values({
      userId: user!.id,
      name: "Alice Encrypted",
      notes: encryptedNotes,
      notesEncrypted: true,
    });

    // A parseable quiz response; the bogus contactId gets filtered out by
    // the service, so no rep rows are created.
    mockLLM.setContent(
      axFieldContent({
        questions: [
          {
            contactId: "not-a-real-contact",
            question: "Where did you meet Alice?",
            options: ["React Conf", "Work", "School", "Gym"],
            correctAnswer: 0,
            sourceField: "notes",
          },
        ],
      }),
    );

    // Having notes is enough to reach generateDetailQuestions.
    const response = await generateMemoryReps({});
    expect(response.status).toBe(200);
    // The request that hit the wire must carry the plaintext notes,
    // never the raw ciphertext.
    expect(mockLLM.requests.length).toBeGreaterThan(0);
    const wirePayload = JSON.stringify(mockLLM.requests);
    expect(wirePayload).toContain(PLAINTEXT_NOTES);
    expect(wirePayload).not.toContain(encryptedNotes);
  });
});
