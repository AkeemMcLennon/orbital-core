import { backend } from "@orbital/testing";
import { createTestToken } from "@orbital/testing/backend/auth";
import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { loadSettings, settings } from "../../src/config";
import * as schema from "../../src/database/schema";
import { startServer } from "../../src/server";
import {
  deriveInstanceHash,
  resetInstanceHashCache,
} from "../../src/services/meilisearch";

type TestServer = backend.TestServer;

// The /settings endpoint only reads env config and signs a tenant-token JWT
// (pure crypto, no network), so it needs no real Meilisearch instance — dummy
// connection values are enough.
const MEILISEARCH_URL = "http://meilisearch.test:7700";
const MEILISEARCH_API_KEY = "test-meili-api-key";
const MEILISEARCH_API_KEY_UID = "11111111-1111-4111-8111-111111111111";

describe("Settings API — search config", () => {
  let server: TestServer;
  let userToken: string;

  beforeAll(async () => {
    await backend.createTestDatabase({
      schema,
      migrationsPath: `${import.meta.dir}/../../src/database/migrations`,
    });

    server = await backend.startTestServer({
      startServer,
      loadSettings,
      envOverrides: {
        MEILISEARCH_URL,
        MEILISEARCH_API_KEY,
        MEILISEARCH_API_KEY_UID,
      },
    });
    // Recompute the instance hash from this run's settings (it's memoized).
    resetInstanceHashCache();

    userToken = await createTestToken({
      sub: "user-1",
      email: "user1@example.com",
    });
  });

  afterAll(() => {
    server.stop();
  });

  describe("GET /rpc/settings", () => {
    it("returns search config when Meilisearch is configured", async () => {
      const res = await fetch(`${server.url}/rpc/settings`, {
        headers: { Authorization: `Bearer ${userToken}` },
      });
      expect(res.status).toBe(200);

      const data = (await res.json()) as {
        search: { url: string; token: string; indexName: string } | null;
      };
      expect(data).toHaveProperty("search");
      expect(data.search).not.toBeNull();
      expect(data.search!.url).toBe(MEILISEARCH_URL);
      expect(typeof data.search!.token).toBe("string");
      expect(data.search!.token.split(".")).toHaveLength(3);
      expect(data.search!.indexName).toBe("contacts");
    });

    it("token payload encodes the correct user and instance scope", async () => {
      const res = await fetch(`${server.url}/rpc/settings`, {
        headers: { Authorization: `Bearer ${userToken}` },
      });
      const { search } = (await res.json()) as { search: { token: string } };

      // Decode JWT payload (middle segment)
      const payloadJson = Buffer.from(
        search.token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"),
        "base64",
      ).toString("utf8");
      const payload = JSON.parse(payloadJson) as {
        apiKeyUid: string;
        searchRules: Record<string, { filter: string }>;
        exp: number;
      };

      expect(payload.apiKeyUid).toBe(MEILISEARCH_API_KEY_UID);
      expect(payload.searchRules).toBeDefined();
      const filter = payload.searchRules?.contacts?.filter ?? "";
      // instanceHash is derived from DB_ENCRYPTION_KEY + the API key UID, not configured.
      expect(filter).toContain(`instanceHash = '${deriveInstanceHash()}'`);
      expect(typeof payload.exp).toBe("number");
      expect(payload.exp).toBeGreaterThan(Math.floor(Date.now() / 1000));
    });

    it("returns null search config when Meilisearch is not configured", async () => {
      // Start a separate server without Meilisearch config.
      // loadSettings mutates a shared singleton, so we snapshot and restore all settings.
      const snapshot = { ...settings } as Record<string, unknown>;
      const serverWithout = await backend.startTestServer({
        startServer,
        loadSettings,
        envOverrides: {},
      });
      try {
        const res = await fetch(`${serverWithout.url}/rpc/settings`, {
          headers: { Authorization: `Bearer ${userToken}` },
        });
        expect(res.status).toBe(200);
        const data = (await res.json()) as { search: unknown };
        expect(data.search).toBeNull();
      } finally {
        serverWithout.stop();
        // Restore all settings so the main server continues to work
        for (const [key, val] of Object.entries(snapshot)) {
          (settings as any)[key] = val;
        }
      }
    });
  });
});
