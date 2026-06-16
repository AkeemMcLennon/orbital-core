// Shared setup + helpers for Meilisearch end-to-end tests (settings + contacts).
// Each test file calls setupMeilisearchE2E() in beforeAll to get its own
// Meilisearch container, configured index, running server, and seeded users.
import { backend } from "@orbital/testing";
import { createTestToken } from "@orbital/testing/backend/auth";
import {
  GenericContainer,
  Wait,
  type StartedTestContainer,
} from "testcontainers";
import { loadSettings } from "../../../src/config";
import type { DatabaseClient } from "../../../src/database/client";
import * as schema from "../../../src/database/schema";
import { startServer } from "../../../src/server";
import {
  meilisearchService,
  resetInstanceHashCache,
} from "../../../src/services/meilisearch";
import { setWaitUntil } from "../../../src/utils/wait-until";

export const MEILI_MASTER_KEY = "test-master-key-for-e2e";

// Track background tasks fired via waitUntil so tests can explicitly flush them.
const pendingTasks: Promise<unknown>[] = [];
setWaitUntil((promise) => {
  pendingTasks.push(promise);
});

export async function flushBackgroundTasks(): Promise<void> {
  await Promise.all([...pendingTasks]);
  pendingTasks.length = 0;
}

export async function createMeilisearchApiKey(
  url: string,
  masterKey: string,
): Promise<{ key: string; uid: string }> {
  const res = await fetch(`${url}/keys`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${masterKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: "e2e-search-key",
      actions: ["search", "indexes.*", "documents.*", "settings.*", "tasks.*"],
      indexes: ["*"],
      expiresAt: null,
    }),
  });
  if (!res.ok) {
    throw new Error(
      `Failed to create Meilisearch API key: ${await res.text()}`,
    );
  }
  const data = (await res.json()) as { key: string; uid: string };
  return { key: data.key, uid: data.uid };
}

export async function searchWithToken(
  meilisearchUrl: string,
  token: string,
  indexName: string,
  query: string,
): Promise<any[]> {
  const res = await fetch(`${meilisearchUrl}/indexes/${indexName}/search`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ q: query }),
  });
  if (!res.ok) {
    throw new Error(
      `Meilisearch search failed: ${res.status} ${await res.text()}`,
    );
  }
  const data = (await res.json()) as { hits?: any[] };
  return data.hits ?? [];
}

// Wait until all pending Meilisearch tasks are done.
export async function waitForMeilisearchTasks(
  url: string,
  masterKey: string,
  timeoutMs = 15_000,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const res = await fetch(`${url}/tasks?statuses=enqueued,processing`, {
      headers: { Authorization: `Bearer ${masterKey}` },
    });
    const data = (await res.json()) as { results?: unknown[] };
    if ((data.results ?? []).length === 0) return;
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error("Meilisearch tasks did not complete in time");
}

// Poll search until the named contact appears or timeout expires.
// More reliable than checking Meilisearch task queue because waitUntil
// fires the index request asynchronously — the queue may appear empty
// before the index request has even been submitted.
export async function waitForContactInSearch(
  url: string,
  token: string,
  indexName: string,
  contactName: string,
  timeoutMs = 15_000,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const hits = await searchWithToken(url, token, indexName, "");
    if (hits.some((h: any) => h.name === contactName)) return;
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error(`Timeout: "${contactName}" never appeared in Meilisearch`);
}

export type MeiliE2EContext = {
  container: StartedTestContainer;
  meilisearchUrl: string;
  apiKey: string;
  apiKeyUid: string;
  server: backend.TestServer;
  db: DatabaseClient;
  user1Token: string;
  user2Token: string;
};

// Starts a Meilisearch container, provisions a search key, pre-configures the
// `contacts` index, then boots a test server wired to it with two seeded users.
export async function setupMeilisearchE2E(): Promise<MeiliE2EContext> {
  const container = await new GenericContainer("getmeili/meilisearch:v1.12")
    .withExposedPorts(7700)
    .withEnvironment({ MEILI_MASTER_KEY })
    .withWaitStrategy(Wait.forHttp("/health", 7700))
    .start();

  const host = container.getHost();
  const port = container.getMappedPort(7700);
  const meilisearchUrl = `http://${host}:${port}`;

  const { key: apiKey, uid: apiKeyUid } = await createMeilisearchApiKey(
    meilisearchUrl,
    MEILI_MASTER_KEY,
  );

  // Pre-configure the contacts index so filterable attributes and primary key are set
  // before any search. The service does this lazily, but that races with the first search.
  await fetch(`${meilisearchUrl}/indexes`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ uid: "contacts", primaryKey: "id" }),
  });
  await fetch(
    `${meilisearchUrl}/indexes/contacts/settings/filterable-attributes`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(["userId", "instanceHash"]),
    },
  );
  await fetch(
    `${meilisearchUrl}/indexes/contacts/settings/searchable-attributes`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify([
        "name",
        "email",
        "phone",
        "jobTitle",
        "company",
        "tags",
      ]),
    },
  );
  await waitForMeilisearchTasks(meilisearchUrl, MEILI_MASTER_KEY, 15_000);
  // Tell the service the index is already configured so it skips redundant settings updates
  meilisearchService.markIndexConfigured();

  const db = await backend.createTestDatabase({
    schema,
    migrationsPath: "./src/database/migrations",
  });

  const server = await backend.startTestServer({
    startServer,
    loadSettings,
    envOverrides: {
      MEILISEARCH_URL: meilisearchUrl,
      MEILISEARCH_API_KEY: apiKey,
      MEILISEARCH_API_KEY_UID: apiKeyUid,
    },
  });

  // Settings now carry this run's API key UID — drop any hash memoized by a
  // previous e2e file so it is recomputed from these settings.
  resetInstanceHashCache();

  const user1Token = await createTestToken({
    sub: "user-1",
    email: "user1@example.com",
  });
  const user2Token = await createTestToken({
    sub: "user-2",
    email: "user2@example.com",
  });

  return {
    container,
    meilisearchUrl,
    apiKey,
    apiKeyUid,
    server,
    db,
    user1Token,
    user2Token,
  };
}

export async function teardownMeilisearchE2E(
  ctx: MeiliE2EContext | undefined,
): Promise<void> {
  ctx?.server?.stop();
  meilisearchService.resetIndexConfigured();
  await ctx?.container?.stop();
}

// Reset the database to a clean state with the two test users seeded.
export async function resetE2EUsers(ctx: MeiliE2EContext): Promise<void> {
  await backend.clearDatabase(ctx.db, { schema });
  await backend.seedTestUser(ctx.db, "user-1", { schema });
  await backend.seedTestUser(ctx.db, "user-2", { schema });
}
