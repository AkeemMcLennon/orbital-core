import { discoverTags, initializeApiClient } from "@orbital/client";
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
import { eq } from "drizzle-orm";
import { loadSettings } from "../../src/config";
import type { DatabaseClient } from "../../src/database/client";
import * as schema from "../../src/database/schema";
import { startServer } from "../../src/server";
import { resetLLMClient } from "../../src/services/llm";

type TestServer = backend.TestServer;

describe("Tag discovery (mocked LLM)", () => {
  let server: TestServer;
  let db: DatabaseClient;
  let mockLLM: MockLLMServer;
  let token: string;

  beforeAll(async () => {
    db = await backend.createTestDatabase({
      schema,
      migrationsPath: "./src/database/migrations",
    });

    mockLLM = await startMockLLMServer();

    server = await backend.startTestServer({
      startServer,
      loadSettings,
      envOverrides: {
        LLM_BASE_URL: mockLLM.url,
        LLM_API_KEY: "fake-key",
        LLM_FAST_MODEL: "fake-model",
      },
    });

    token = await createTestToken({
      sub: "discovery-user",
      email: "discovery@example.com",
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
    await backend.seedTestUser(db, "discovery-user", { schema });
  });

  /** Insert contacts directly to bypass the on-write per-contact tag generator. */
  async function seedContacts(notesList: string[]) {
    const [user] = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.externalId, "discovery-user"))
      .limit(1);
    if (!user) throw new Error("seed user missing");

    await db.insert(schema.contacts).values(
      notesList.map((notes, i) => ({
        userId: user.id,
        name: `Person ${i + 1}`,
        notes,
        notesEncrypted: false,
      })),
    );

    return db
      .select()
      .from(schema.contacts)
      .where(eq(schema.contacts.userId, user.id));
  }

  it("discovers tags and assigns them to all contacts", async () => {
    const contacts = await seedContacts([
      "Met Dana through the Acme Founders accelerator.",
      "Eric is another Acme Founders program graduate.",
      "Farah connected via the Acme Founders alumni network.",
    ]);

    let callCount = 0;
    mockLLM.setHandler(() => {
      callCount++;
      if (callCount === 1) {
        // Pass 1: discovery — propose cross-contact tags
        return axFieldContent({ tags: ["acme-founders", "tech-community"] });
      }
      // Pass 2: assignment — map tags to contacts by id
      return axFieldContent({
        assignments: contacts.map((c) => `${c.id}: acme-founders`),
      });
    });

    const res = await discoverTags();
    if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
    expect(res.data.discovered).toContain("acme-founders");
    expect(res.data.discovered).toContain("tech-community");
    expect(res.data.assignedContacts).toBe(3);

    // All three contacts should have the dynamic tag in the DB.
    const taggedRows = await db
      .select()
      .from(schema.contactTags)
      .where(eq(schema.contactTags.isDynamic, true));
    expect(new Set(taggedRows.map((r) => r.contactId)).size).toBe(3);

    // Exactly two LLM calls should have been made (discovery + assignment).
    expect(mockLLM.requests).toHaveLength(2);
  });

  it("only tags contacts the LLM includes in the assignment", async () => {
    const contacts = await seedContacts([
      "First contact — clearly relevant.",
      "Second contact — also relevant.",
      "Third contact — unrelated.",
    ]);

    const [c1, c2, c3] = contacts;
    let callCount = 0;
    mockLLM.setHandler(() => {
      callCount++;
      if (callCount === 1) {
        return axFieldContent({ tags: ["investor"] });
      }
      // Assign only to the first two contacts; omit the third.
      return axFieldContent({
        assignments: [`${c1.id}: investor`, `${c2.id}: investor`],
      });
    });

    const res = await discoverTags();
    if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
    expect(res.data.assignedContacts).toBe(2);

    // Third contact must have no dynamic tags.
    const c3Tags = await db
      .select()
      .from(schema.contactTags)
      .where(eq(schema.contactTags.contactId, c3.id));
    expect(c3Tags).toHaveLength(0);
  });

  it("makes no LLM calls and returns empty when no contacts have notes", async () => {
    const [user] = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.externalId, "discovery-user"))
      .limit(1);
    await db.insert(schema.contacts).values({
      userId: user!.id,
      name: "No-Notes Contact",
      notesEncrypted: false,
    });

    const res = await discoverTags();
    if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
    expect(res.data.discovered).toHaveLength(0);
    expect(res.data.assignedContacts).toBe(0);
    expect(mockLLM.requests).toHaveLength(0);
  });

  it("handles a discovery LLM error gracefully", async () => {
    await seedContacts(["Some notes that would normally trigger discovery."]);
    mockLLM.setError(); // 400 — Ax treats client errors as non-retryable

    const res = await discoverTags();
    if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
    expect(res.data.discovered).toHaveLength(0);
    expect(res.data.assignedContacts).toBe(0);

    // No dynamic tags should have been written.
    const dynamic = await db
      .select()
      .from(schema.contactTags)
      .where(eq(schema.contactTags.isDynamic, true));
    expect(dynamic).toHaveLength(0);
  });
});
