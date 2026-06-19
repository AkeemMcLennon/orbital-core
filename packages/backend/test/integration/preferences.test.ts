import {
  getPreferences,
  updatePreferences,
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
import { loadSettings } from "../../src/config";
import type { DatabaseClient } from "../../src/database/client";
import * as schema from "../../src/database/schema";
import { startServer } from "../../src/server";

type TestServer = backend.TestServer;

describe("Preferences API", () => {
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

  describe("GET /rpc/preferences", () => {
    it("returns default preferences for a new user", async () => {
      const response = await getPreferences();
      expect(response.status).toBe(200);
      const data = getSuccessData(response);
      expect(data?.memRepInitialDelayHours).toBe(72);
    });

    it("returns stored value after a PUT", async () => {
      await updatePreferences({ memRepInitialDelayHours: 48 });

      const response = await getPreferences();
      expect(response.status).toBe(200);
      const data = getSuccessData(response);
      expect(data?.memRepInitialDelayHours).toBe(48);
    });
  });

  describe("PUT /rpc/preferences", () => {
    it("updates and returns the new value", async () => {
      const response = await updatePreferences({
        memRepInitialDelayHours: 120,
      });
      expect(response.status).toBe(200);
      const data = getSuccessData(response);
      expect(data?.memRepInitialDelayHours).toBe(120);
    });

    it("can update to 0 hours", async () => {
      const response = await updatePreferences({ memRepInitialDelayHours: 0 });
      expect(response.status).toBe(200);
      const data = getSuccessData(response);
      expect(data?.memRepInitialDelayHours).toBe(0);
    });

    it("can update to the maximum (720 hours)", async () => {
      const response = await updatePreferences({
        memRepInitialDelayHours: 720,
      });
      expect(response.status).toBe(200);
      const data = getSuccessData(response);
      expect(data?.memRepInitialDelayHours).toBe(720);
    });

    it("rejects negative values", async () => {
      const response = await updatePreferences({ memRepInitialDelayHours: -1 });
      expect(response.status).toBe(400);
    });

    it("rejects values above 720", async () => {
      const response = await updatePreferences({
        memRepInitialDelayHours: 721,
      });
      expect(response.status).toBe(400);
    });

    it("is idempotent — repeated PUTs with the same value succeed", async () => {
      await updatePreferences({ memRepInitialDelayHours: 96 });
      const response = await updatePreferences({ memRepInitialDelayHours: 96 });
      expect(response.status).toBe(200);
      const data = getSuccessData(response);
      expect(data?.memRepInitialDelayHours).toBe(96);
    });
  });

  describe("user isolation", () => {
    it("user1 preferences do not affect user2", async () => {
      // User 1 sets a custom preference
      await updatePreferences({ memRepInitialDelayHours: 168 });

      // Switch to user 2
      initializeApiClient({
        baseURL: `${server.url}/rpc`,
        getToken: () => user2Token,
      });

      // User 2 should still see the default
      const response = await getPreferences();
      expect(response.status).toBe(200);
      const data = getSuccessData(response);
      expect(data?.memRepInitialDelayHours).toBe(72);

      // Restore user 1
      initializeApiClient({
        baseURL: `${server.url}/rpc`,
        getToken: () => user1Token,
      });
    });
  });
});
