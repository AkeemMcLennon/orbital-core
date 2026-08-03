import {
  bulkCreateContacts,
  getContactById,
  getContacts,
  initializeApiClient,
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
import { loadSettings } from "../../src/config";
import type { DatabaseClient } from "../../src/database/client";
import * as schema from "../../src/database/schema";
import { startServer } from "../../src/server";

type TestServer = backend.TestServer;

describe("POST /rpc/contacts/bulk", () => {
  let server: TestServer;
  let db: DatabaseClient;
  let user1Token: string;
  let user2Token: string;

  beforeAll(async () => {
    db = await backend.createTestDatabase({
      schema,
      migrationsPath: "./src/database/migrations",
    });
    server = await backend.startTestServer({ startServer, loadSettings });

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

  it("creates multiple contacts and returns them as an array", async () => {
    const response = await bulkCreateContacts({
      contacts: [
        { name: "Alice Smith", email: "alice@example.com", company: "Acme" },
        { name: "Bob Jones", phone: "+1234567890" },
        { name: "Carol White", company: "Widget Co" },
      ],
    });

    expect(response.status).toBe(200);
    if (response.status !== 200) return;
    expect(response.data).toHaveLength(3);

    const names = response.data.map((c) => c.name);
    expect(names).toContain("Alice Smith");
    expect(names).toContain("Bob Jones");
    expect(names).toContain("Carol White");
  });

  it("creates a single contact and returns a 1-element array", async () => {
    const response = await bulkCreateContacts({
      contacts: [{ name: "Solo Contact", email: "solo@example.com" }],
    });

    expect(response.status).toBe(200);
    if (response.status !== 200) return;
    expect(response.data).toHaveLength(1);
    expect(response.data[0].name).toBe("Solo Contact");
    expect(response.data[0].email).toBe("solo@example.com");
    expect(typeof response.data[0].id).toBe("string");
  });

  it("assigns each contact to the authenticated user", async () => {
    await bulkCreateContacts({
      contacts: [{ name: "User Contact A" }, { name: "User Contact B" }],
    });

    const listResponse = await getContacts({ limit: 50, offset: 0 });
    expect(listResponse.status).toBe(200);
    if (listResponse.status !== 200) return;
    expect(listResponse.data.items).toHaveLength(2);
  });

  it("does not expose user-1 contacts to user-2", async () => {
    await bulkCreateContacts({ contacts: [{ name: "User1 Private" }] });

    initializeApiClient({
      baseURL: `${server.url}/rpc`,
      getToken: () => user2Token,
    });

    const listResponse = await getContacts({ limit: 50, offset: 0 });
    expect(listResponse.status).toBe(200);
    if (listResponse.status !== 200) return;
    expect(listResponse.data.items).toHaveLength(0);

    initializeApiClient({
      baseURL: `${server.url}/rpc`,
      getToken: () => user1Token,
    });
  });

  it("returns 401 without a valid token", async () => {
    initializeApiClient({
      baseURL: `${server.url}/rpc`,
      getToken: () => "invalid-token",
    });

    const response = await bulkCreateContacts({
      contacts: [{ name: "Should Fail" }],
    });
    expect(response.status).toBe(401);

    initializeApiClient({
      baseURL: `${server.url}/rpc`,
      getToken: () => user1Token,
    });
  });

  it("returns 400 for an empty contacts array", async () => {
    const response = await bulkCreateContacts({ contacts: [] });
    expect(response.status).toBe(400);
  });

  it("persists each contact's links", async () => {
    const response = await bulkCreateContacts({
      contacts: [
        {
          name: "Linked Person",
          links: [
            { type: "linkedin", value: "janedoe" },
            { type: "github", value: "janedoe" },
          ],
        },
        { name: "Unlinked Person" },
      ],
    });
    expect(response.status).toBe(200);
    if (response.status !== 200) return;

    const linked = await getContactById(response.data[0].id);
    expect(linked.status).toBe(200);
    if (linked.status !== 200) return;
    // Rows share a createdAt, so the read order isn't defined — compare as a set.
    expect(
      linked.data.links?.map((l) => `${l.type}:${l.value}`).sort(),
    ).toEqual(["github:janedoe", "linkedin:janedoe"]);

    const unlinked = await getContactById(response.data[1].id);
    if (unlinked.status !== 200) return;
    expect(unlinked.data.links ?? []).toHaveLength(0);
  });

  it("persists tags, reusing one tag row across contacts", async () => {
    const response = await bulkCreateContacts({
      contacts: [
        { name: "Tagged A", tags: ["Conference", "Investor"] },
        { name: "Tagged B", tags: ["Conference"] },
      ],
    });
    expect(response.status).toBe(200);
    if (response.status !== 200) return;

    const a = await getContactById(response.data[0].id);
    const b = await getContactById(response.data[1].id);
    if (a.status !== 200 || b.status !== 200) return;

    expect(a.data.tags?.map((t) => t.name).sort()).toEqual([
      "Conference",
      "Investor",
    ]);
    expect(b.data.tags?.map((t) => t.name)).toEqual(["Conference"]);
    // Same name → same row, not a duplicate per contact.
    const aConference = a.data.tags?.find((t) => t.name === "Conference");
    const bConference = b.data.tags?.find((t) => t.name === "Conference");
    expect(aConference?.id).toBe(bConference!.id);
  });

  it("resolves whitespace variants of a tag name to the same tag row", async () => {
    // Regression: tag ids used to be zipped positionally against the raw name
    // list, while resolution trimmed and deduped internally — ' Conference '
    // could get another tag's id, or lose its tag entirely.
    const response = await bulkCreateContacts({
      contacts: [
        { name: "Clean Tag", tags: ["Conference"] },
        { name: "Padded Tag", tags: [" Conference ", "Learning"] },
      ],
    });
    expect(response.status).toBe(200);
    if (response.status !== 200) return;

    const clean = await getContactById(response.data[0].id);
    const padded = await getContactById(response.data[1].id);
    if (clean.status !== 200 || padded.status !== 200) return;

    expect(padded.data.tags?.map((t) => t.name).sort()).toEqual([
      "Conference",
      "Learning",
    ]);
    const cleanConf = clean.data.tags?.find((t) => t.name === "Conference");
    const paddedConf = padded.data.tags?.find((t) => t.name === "Conference");
    expect(cleanConf?.id).toBe(paddedConf!.id);
  });

  it("persists more links than one insert's parameter budget", async () => {
    // 20 links exceeds the per-insert channel batch, so this exercises the
    // chunked link insert path.
    const links = Array.from({ length: 20 }, (_, i) => ({
      type: "website" as const,
      value: `https://example.com/${i}`,
    }));
    const response = await bulkCreateContacts({
      contacts: [{ name: "Many Links", links }],
    });
    expect(response.status).toBe(200);
    if (response.status !== 200) return;

    const fetched = await getContactById(response.data[0].id);
    if (fetched.status !== 200) return;
    expect(fetched.data.links?.map((l) => l.value).sort()).toEqual(
      links.map((l) => l.value).sort(),
    );
  });

  it("attaches links and tags to the right contact across a multi-row insert", async () => {
    // Regression: links/tags/response were paired with the request by array
    // position against `INSERT ... RETURNING`, whose row order SQLite leaves
    // undefined. Spans several insert batches so a reordering would show up.
    const contacts = Array.from({ length: 12 }, (_, i) => ({
      name: `Ordered ${i}`,
      links: [{ type: "website" as const, value: `https://example.com/${i}` }],
      tags: [`tag-${i}`],
    }));

    const response = await bulkCreateContacts({ contacts });
    expect(response.status).toBe(200);
    if (response.status !== 200) return;

    // The client pairs this response with its own list by index.
    expect(response.data.map((c) => c.name)).toEqual(
      contacts.map((c) => c.name),
    );

    for (const [i, row] of response.data.entries()) {
      const fetched = await getContactById(row.id);
      if (fetched.status !== 200) throw new Error(`fetch failed for ${row.id}`);
      expect(fetched.data.name).toBe(`Ordered ${i}`);
      expect(fetched.data.links?.map((l) => l.value)).toEqual([
        `https://example.com/${i}`,
      ]);
      expect(fetched.data.tags?.map((t) => t.name)).toEqual([`tag-${i}`]);
    }
  });

  it("round-trips notes as plaintext even when stored encrypted", async () => {
    const notes = "Phone (work): +1 555 9999\nMet at the Berlin meetup";
    const response = await bulkCreateContacts({
      contacts: [{ name: "Noted Person", notes }],
    });
    expect(response.status).toBe(200);
    if (response.status !== 200) return;
    expect(response.data[0].notes).toBe(notes);

    const fetched = await getContactById(response.data[0].id);
    if (fetched.status !== 200) return;
    expect(fetched.data.notes).toBe(notes);
  });

  it("creates a batch larger than one insert's parameter budget", async () => {
    // D1 caps bound parameters per query, so the handler splits the insert.
    // 25 contacts spans several batches; all must land, in input order.
    const contacts = Array.from({ length: 25 }, (_, i) => ({
      name: `Batched ${i}`,
      phone: `+1555000${String(i).padStart(4, "0")}`,
    }));

    const response = await bulkCreateContacts({ contacts });
    expect(response.status).toBe(200);
    if (response.status !== 200) return;
    expect(response.data).toHaveLength(25);
    expect(response.data.map((c) => c.name)).toEqual(
      contacts.map((c) => c.name),
    );

    const listResponse = await getContacts({ limit: 50, offset: 0 });
    if (listResponse.status !== 200) return;
    expect(listResponse.data.items).toHaveLength(25);
  });
});
