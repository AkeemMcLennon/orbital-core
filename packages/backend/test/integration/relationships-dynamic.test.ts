import {
  createContact,
  updateContact,
  createRelationship,
  listContactRelationships,
  initializeApiClient,
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
import { loadSettings } from "../../src/config";
import type { DatabaseClient } from "../../src/database/client";
import * as schema from "../../src/database/schema";
import { startServer } from "../../src/server";
import { resetLLMClient } from "../../src/services/llm";

type TestServer = backend.TestServer;

describe("Dynamic relationship derivation", () => {
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
      sub: "rel-user",
      email: "rel@example.com",
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
    await backend.seedTestUser(db, "rel-user", { schema });
  });

  it("derives a relationship when the LLM extracts a contact name from notes", async () => {
    const bobRes = await createContact({ name: "Bob" });
    if (bobRes.status !== 200)
      throw new Error("Expected 200 from createContact");

    mockLLM.setContent(
      axFieldContent({
        mentions: ["Bob"],
        types: ["friend"],
        descriptions: ["Close friends since college."],
      }),
    );

    const aliceRes = await createContact({
      name: "Alice",
      notes: "Met Alice at a conference — she's close friends with Bob.",
    });
    if (aliceRes.status !== 200)
      throw new Error("Expected 200 from createContact");

    await new Promise((r) => setTimeout(r, 200));

    const relsRes = await listContactRelationships(aliceRes.data.id);
    if (relsRes.status !== 200)
      throw new Error("Expected 200 from listContactRelationships");

    expect(relsRes.data.items.length).toBeGreaterThanOrEqual(1);
    expect(
      relsRes.data.items.some((r) => r.relatedContact?.name === "Bob"),
    ).toBe(true);
  });

  it("preserves existing relationships when notes are updated to mention someone new", async () => {
    const carolRes = await createContact({ name: "Carol" });
    if (carolRes.status !== 200)
      throw new Error("Expected 200 from createContact");

    const eveRes = await createContact({ name: "Eve" });
    if (eveRes.status !== 200)
      throw new Error("Expected 200 from createContact");

    mockLLM.setContent(
      axFieldContent({
        mentions: ["Carol"],
        types: ["investor"],
        descriptions: ["Carol vouched for him."],
      }),
    );

    const daveRes = await createContact({
      name: "Dave",
      notes: "Dave connected through Carol at the last summit.",
    });
    if (daveRes.status !== 200)
      throw new Error("Expected 200 from createContact");
    const daveId = daveRes.data.id;

    await new Promise((r) => setTimeout(r, 200));

    mockLLM.setContent(
      axFieldContent({
        mentions: ["Eve"],
        types: ["partner"],
        descriptions: ["Now partnering with Eve on a new fund."],
      }),
    );

    await updateContact(daveId, {
      notes:
        "Caught up with Dave — he's now partnering with Eve on a new fund.",
    });

    await new Promise((r) => setTimeout(r, 200));

    const relsRes = await listContactRelationships(daveId);
    if (relsRes.status !== 200)
      throw new Error("Expected 200 from listContactRelationships");

    expect(
      relsRes.data.items.some((r) => r.relatedContact?.name === "Carol"),
    ).toBe(true);
    expect(
      relsRes.data.items.some((r) => r.relatedContact?.name === "Eve"),
    ).toBe(true);
  });

  it("preserves a static relationship when the LLM would derive the same pair", async () => {
    const frankRes = await createContact({ name: "Frank" });
    if (frankRes.status !== 200)
      throw new Error("Expected 200 from createContact");

    const graceRes = await createContact({ name: "Grace" });
    if (graceRes.status !== 200)
      throw new Error("Expected 200 from createContact");

    const relRes = await createRelationship({
      contactId: graceRes.data.id,
      relatedContactId: frankRes.data.id,
      type: "mentor",
      sentiment: 2,
    });
    if (relRes.status !== 200)
      throw new Error("Expected 200 from createRelationship");

    mockLLM.setContent(
      axFieldContent({
        mentions: ["Frank"],
        types: ["colleague"],
        descriptions: ["Works with Frank regularly."],
      }),
    );

    await updateContact(graceRes.data.id, {
      notes: "Grace has been mentored by Frank for two years.",
    });

    await new Promise((r) => setTimeout(r, 200));

    const relsRes = await listContactRelationships(graceRes.data.id);
    if (relsRes.status !== 200)
      throw new Error("Expected 200 from listContactRelationships");

    // Frank must appear exactly once — the static row is not overwritten
    const frankRels = relsRes.data.items.filter(
      (r) => r.relatedContact?.name === "Frank",
    );
    expect(frankRels).toHaveLength(1);
    expect(frankRels[0].type).toBe("mentor");
  });

  it("does not create a relationship when the mentioned name has no matching contact", async () => {
    mockLLM.setContent(
      axFieldContent({
        mentions: ["Zephyrine"],
        types: ["friend"],
        descriptions: ["Old collaborator."],
      }),
    );

    const henryRes = await createContact({
      name: "Henry",
      notes: "Henry mentioned he used to work with someone named Zephyrine.",
    });
    if (henryRes.status !== 200)
      throw new Error("Expected 200 from createContact");

    await new Promise((r) => setTimeout(r, 200));

    const relsRes = await listContactRelationships(henryRes.data.id);
    if (relsRes.status !== 200)
      throw new Error("Expected 200 from listContactRelationships");

    expect(relsRes.data.items).toHaveLength(0);
  });

  it("matches by word boundary — 'Carl' matches 'Carl Smith' but not 'Carla'", async () => {
    const carlSmithRes = await createContact({ name: "Carl Smith" });
    if (carlSmithRes.status !== 200)
      throw new Error("Expected 200 from createContact");

    const carlaRes = await createContact({ name: "Carla" });
    if (carlaRes.status !== 200)
      throw new Error("Expected 200 from createContact");

    mockLLM.setContent(
      axFieldContent({
        mentions: ["Carl"],
        types: ["colleague"],
        descriptions: ["Working together on the launch."],
      }),
    );

    const aliceRes = await createContact({
      name: "Alice",
      notes: "Alice has been working closely with Carl on the product launch.",
    });
    if (aliceRes.status !== 200)
      throw new Error("Expected 200 from createContact");

    await new Promise((r) => setTimeout(r, 200));

    const relsRes = await listContactRelationships(aliceRes.data.id);
    if (relsRes.status !== 200)
      throw new Error("Expected 200 from listContactRelationships");

    expect(
      relsRes.data.items.some((r) => r.relatedContact?.name === "Carl Smith"),
    ).toBe(true);
    expect(
      relsRes.data.items.some((r) => r.relatedContact?.name === "Carla"),
    ).toBe(false);
  });

  it("matches a full-name mention against a contact stored by first name only", async () => {
    // Contact stored as the short form "Bob"; LLM extracts the full "Bob Smith"
    const bobRes = await createContact({ name: "Bob" });
    if (bobRes.status !== 200)
      throw new Error("Expected 200 from createContact");

    mockLLM.setContent(
      axFieldContent({
        mentions: ["Bob Smith"],
        types: ["friend"],
        descriptions: ["Old friend."],
      }),
    );

    const aliceRes = await createContact({
      name: "Alice",
      notes: "Alice is good friends with Bob Smith from her old firm.",
    });
    if (aliceRes.status !== 200)
      throw new Error("Expected 200 from createContact");

    await new Promise((r) => setTimeout(r, 200));

    const relsRes = await listContactRelationships(aliceRes.data.id);
    if (relsRes.status !== 200)
      throw new Error("Expected 200 from listContactRelationships");

    expect(
      relsRes.data.items.some((r) => r.relatedContact?.name === "Bob"),
    ).toBe(true);
  });

  it("matches a bare last-name mention against a contact's last name", async () => {
    const swainRes = await createContact({ name: "Matt Swain" });
    if (swainRes.status !== 200)
      throw new Error("Expected 200 from createContact");

    mockLLM.setContent(
      axFieldContent({
        mentions: ["Swain"],
        types: ["colleague"],
        descriptions: ["Works on the same team."],
      }),
    );

    const aliceRes = await createContact({
      name: "Alice",
      notes: "Alice reports to Swain on the platform team.",
    });
    if (aliceRes.status !== 200)
      throw new Error("Expected 200 from createContact");

    await new Promise((r) => setTimeout(r, 200));

    const relsRes = await listContactRelationships(aliceRes.data.id);
    if (relsRes.status !== 200)
      throw new Error("Expected 200 from listContactRelationships");

    expect(
      relsRes.data.items.some((r) => r.relatedContact?.name === "Matt Swain"),
    ).toBe(true);
  });

  it("prefers a first-name match over a last-name match for an ambiguous mention", async () => {
    // "Kyle" is the first name of one contact and the last name of another
    const kyleSmithRes = await createContact({ name: "Kyle Smith" });
    if (kyleSmithRes.status !== 200)
      throw new Error("Expected 200 from createContact");

    const selenaKyleRes = await createContact({ name: "Selena Kyle" });
    if (selenaKyleRes.status !== 200)
      throw new Error("Expected 200 from createContact");

    mockLLM.setContent(
      axFieldContent({
        mentions: ["Kyle"],
        types: ["friend"],
        descriptions: ["Mutual friend."],
      }),
    );

    const aliceRes = await createContact({
      name: "Alice",
      notes: "Alice grabbed coffee with Kyle last week.",
    });
    if (aliceRes.status !== 200)
      throw new Error("Expected 200 from createContact");

    await new Promise((r) => setTimeout(r, 200));

    const relsRes = await listContactRelationships(aliceRes.data.id);
    if (relsRes.status !== 200)
      throw new Error("Expected 200 from listContactRelationships");

    expect(
      relsRes.data.items.some((r) => r.relatedContact?.name === "Kyle Smith"),
    ).toBe(true);
    expect(
      relsRes.data.items.some((r) => r.relatedContact?.name === "Selena Kyle"),
    ).toBe(false);
  });

  it("does not link a full-name mention to a same-first-name different-last-name contact", async () => {
    const bobSmithRes = await createContact({ name: "Bob Smith" });
    if (bobSmithRes.status !== 200)
      throw new Error("Expected 200 from createContact");

    const bobJonesRes = await createContact({ name: "Bob Jones" });
    if (bobJonesRes.status !== 200)
      throw new Error("Expected 200 from createContact");

    mockLLM.setContent(
      axFieldContent({
        mentions: ["Bob Smith"],
        types: ["colleague"],
        descriptions: ["Same department."],
      }),
    );

    const aliceRes = await createContact({
      name: "Alice",
      notes: "Alice sits next to Bob Smith.",
    });
    if (aliceRes.status !== 200)
      throw new Error("Expected 200 from createContact");

    await new Promise((r) => setTimeout(r, 200));

    const relsRes = await listContactRelationships(aliceRes.data.id);
    if (relsRes.status !== 200)
      throw new Error("Expected 200 from listContactRelationships");

    expect(
      relsRes.data.items.some((r) => r.relatedContact?.name === "Bob Smith"),
    ).toBe(true);
    expect(
      relsRes.data.items.some((r) => r.relatedContact?.name === "Bob Jones"),
    ).toBe(false);
  });

  it("creates a linked mirror row visible from the related contact", async () => {
    const bobRes = await createContact({ name: "Bob" });
    if (bobRes.status !== 200)
      throw new Error("Expected 200 from createContact");

    mockLLM.setContent(
      axFieldContent({
        mentions: ["Bob"],
        types: ["friend"],
        descriptions: ["Close friends."],
      }),
    );

    const aliceRes = await createContact({
      name: "Alice",
      notes: "Alice is close friends with Bob.",
    });
    if (aliceRes.status !== 200)
      throw new Error("Expected 200 from createContact");

    await new Promise((r) => setTimeout(r, 200));

    // The reverse/mirror row must exist so Bob's relationship list shows Alice
    const bobRels = await listContactRelationships(bobRes.data.id);
    if (bobRels.status !== 200)
      throw new Error("Expected 200 from listContactRelationships");

    const mirror = bobRels.data.items.find(
      (r) => r.relatedContact?.name === "Alice",
    );
    expect(mirror).toBeDefined();
    expect(mirror?.mirrorId).toBeTruthy();
  });

  it("does not invoke the LLM when no notes are provided", async () => {
    const res = await createContact({ name: "Alice" });
    if (res.status !== 200) throw new Error("Expected 200 from createContact");

    await new Promise((r) => setTimeout(r, 200));

    expect(mockLLM.requests).toHaveLength(0);
  });
});
