import {
  getMemoryReps,
  generateMemoryReps,
  answerMemoryRep,
  initializeApiClient,
  getSuccessData,
} from "@orbital/client";
import { backend } from "@orbital/testing";
import { createTestToken } from "@orbital/testing/backend/auth";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from "bun:test";
import { eq } from "drizzle-orm";
import { loadSettings } from "../../src/config";
import type { DatabaseClient } from "../../src/database/client";
import * as schema from "../../src/database/schema";
import { startServer } from "../../src/server";

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
    // Seed 4 contacts (>= 4 needed for identify questions)
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
      expect(res2.status).toBe(409);
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

      const response = await generateMemoryReps({});
      expect(response.status).toBe(400);
    });

    it("should generate identify questions without LLM when contacts have avatars", async () => {
      // Seed 4 contacts with avatars but no notes (no LLM call needed)
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
      expect(data.items.every((i) => i.options.length === 4)).toBe(true);
    });

    it("should not generate identify questions with fewer than 4 contacts", async () => {
      // Only 3 contacts — not enough for 4-option multiple choice
      for (const name of ["Alice", "Bob", "Charlie"]) {
        await seedRichContact(db, "user-1", {
          name,
          avatarUrl: `https://example.com/${name.toLowerCase()}.jpg`,
        });
      }

      const response = await generateMemoryReps({});
      const data = getSuccessData(response);
      if (!data) throw new Error("No data");

      expect(data.generated).toBe(0);
      expect(data.items).toEqual([]);
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

      // Should generate identify for the 2 with avatars
      expect(data.items).toHaveLength(2);
      expect(data.items.every((i) => i.questionType === "identify")).toBe(true);
      expect(data.items.every((i) => i.contactAvatarUrl !== null)).toBe(true);
    });

    it("should include correct name in identify question options", async () => {
      const names = ["Alice", "Bob", "Charlie", "Diana"];
      for (const name of names) {
        await seedRichContact(db, "user-1", {
          name,
          avatarUrl: `https://example.com/${name.toLowerCase()}.jpg`,
        });
      }

      const response = await generateMemoryReps({});
      const data = getSuccessData(response);
      if (!data) throw new Error("No data");

      for (const item of data.items) {
        // The correct answer option must match the contact name
        expect(item.options[item.correctAnswer]).toBe(item.contactName);
        // All 4 options should be from the seeded names
        for (const opt of item.options) {
          expect(names).toContain(opt);
        }
        // No duplicate options
        expect(new Set(item.options).size).toBe(4);
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

      // Generate
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
      const wrongData = getSuccessData(wrongRes);
      expect(wrongData.correct).toBe(false);
      expect(wrongData.correctAnswer).toBe(first.correctAnswer);

      // Answer second question correctly
      const rightRes = await answerMemoryRep(second.id, {
        selectedAnswer: second.correctAnswer,
      });
      expect(rightRes.status).toBe(200);
      const rightData = getSuccessData(rightRes);
      expect(rightData.correct).toBe(true);
      expect(rightData.correctAnswer).toBe(second.correctAnswer);

      // Verify answered reps are excluded from default list
      const listRes = await getMemoryReps();
      const listData = getSuccessData(listRes);
      const answeredIds = [first.id, second.id];
      for (const item of listData.items) {
        expect(answeredIds).not.toContain(item.id);
      }

      // Verify answered reps appear with includeAnswered=true
      const allRes = await getMemoryReps({ includeAnswered: true });
      const allData = getSuccessData(allRes);
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
});
