import {
  bulkCreateContacts,
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
});
