import { requestAccountDeletion, initializeApiClient } from "@orbital/client";
import { backend } from "@orbital/testing";
import { createTestToken } from "@orbital/testing/backend/auth";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "bun:test";
import { eq, and } from "drizzle-orm";
import { loadSettings } from "../../src/config";
import type { DatabaseClient } from "../../src/database/client";
import * as schema from "../../src/database/schema";
import { startServer } from "../../src/server";
import { processAccountDeletions } from "../../src/services/account-deletion";

type TestServer = backend.TestServer;

describe("Account Deletion", () => {
  let server: TestServer;
  let db: DatabaseClient;
  let user1Token: string;

  beforeAll(async () => {
    db = await backend.createTestDatabase({
      schema,
      migrationsPath: "./src/database/migrations",
    });
    server = await backend.startTestServer({ startServer, loadSettings });

    user1Token = await createTestToken({ sub: "user-1", email: "user1@example.com" });

    initializeApiClient({
      baseURL: `${server.url}/rpc`,
      getToken: () => user1Token,
    });
  });

  afterAll(() => server.stop());

  beforeEach(async () => {
    await backend.clearDatabase(db, { schema });
    await backend.seedTestUser(db, "user-1", { schema });
  });

  describe("POST /rpc/account/request-deletion", () => {
    it("creates a pending deletion queue entry", async () => {
      const res = await requestAccountDeletion();

      expect(res.status).toBe(200);
      if (res.status !== 200) throw new Error("expected 200");

      expect(res.data.message).toContain("14 days");
      expect(res.data.scheduledDeleteAt).toBeDefined();

      const scheduledDate = new Date(res.data.scheduledDeleteAt);
      const expectedMin = Date.now() + 13 * 24 * 60 * 60 * 1000;
      const expectedMax = Date.now() + 15 * 24 * 60 * 60 * 1000;
      expect(scheduledDate.getTime()).toBeGreaterThan(expectedMin);
      expect(scheduledDate.getTime()).toBeLessThan(expectedMax);

      const [user] = await db
        .select()
        .from(schema.users)
        .where(eq(schema.users.externalId, "user-1"))
        .limit(1);

      const [entry] = await db
        .select()
        .from(schema.deletionQueue)
        .where(
          and(
            eq(schema.deletionQueue.userId, user.id),
            eq(schema.deletionQueue.status, "pending"),
          ),
        )
        .limit(1);

      expect(entry).toBeDefined();
      expect(entry.status).toBe("pending");
    });

    it("calling the endpoint twice results in one pending entry (auth middleware cancels and recreates)", async () => {
      await requestAccountDeletion();
      await requestAccountDeletion();

      const [user] = await db
        .select()
        .from(schema.users)
        .where(eq(schema.users.externalId, "user-1"))
        .limit(1);

      const pending = await db
        .select()
        .from(schema.deletionQueue)
        .where(
          and(
            eq(schema.deletionQueue.userId, user.id),
            eq(schema.deletionQueue.status, "pending"),
          ),
        );

      expect(pending.length).toBe(1);
    });
  });

  describe("processAccountDeletions", () => {
    it("does not delete user before 14 days have elapsed", async () => {
      const [user] = await db
        .select()
        .from(schema.users)
        .where(eq(schema.users.externalId, "user-1"))
        .limit(1);

      await backend.seedTestContacts(db, "user-1", { schema }, 3);

      const futureDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
      await db.insert(schema.deletionQueue).values({
        id: crypto.randomUUID(),
        userId: user.id,
        scheduledDeleteAt: futureDate,
      });

      const deleted = await processAccountDeletions(db);
      expect(deleted).toBe(0);

      const [stillExists] = await db
        .select()
        .from(schema.users)
        .where(eq(schema.users.id, user.id))
        .limit(1);
      expect(stillExists).toBeDefined();

      const contacts = await db
        .select()
        .from(schema.contacts)
        .where(eq(schema.contacts.userId, user.id));
      expect(contacts.length).toBe(3);
    });

    it("deletes user and all associated data after 14 days", async () => {
      const [user] = await db
        .select()
        .from(schema.users)
        .where(eq(schema.users.externalId, "user-1"))
        .limit(1);

      await backend.seedTestContacts(db, "user-1", { schema }, 3);

      // Simulate time elapsed: scheduledDeleteAt in the past
      const pastDate = new Date(Date.now() - 1000);
      await db.insert(schema.deletionQueue).values({
        id: crypto.randomUUID(),
        userId: user.id,
        scheduledDeleteAt: pastDate,
      });

      const deleted = await processAccountDeletions(db);
      expect(deleted).toBe(1);

      const [gone] = await db
        .select()
        .from(schema.users)
        .where(eq(schema.users.id, user.id))
        .limit(1);
      expect(gone).toBeUndefined();

      const contacts = await db
        .select()
        .from(schema.contacts)
        .where(eq(schema.contacts.userId, user.id));
      expect(contacts.length).toBe(0);
    });

    it("only processes pending entries, not canceled ones", async () => {
      const [user] = await db
        .select()
        .from(schema.users)
        .where(eq(schema.users.externalId, "user-1"))
        .limit(1);

      const pastDate = new Date(Date.now() - 1000);
      await db.insert(schema.deletionQueue).values({
        id: crypto.randomUUID(),
        userId: user.id,
        scheduledDeleteAt: pastDate,
        status: "canceled",
      });

      const deleted = await processAccountDeletions(db);
      expect(deleted).toBe(0);

      const [stillExists] = await db
        .select()
        .from(schema.users)
        .where(eq(schema.users.id, user.id))
        .limit(1);
      expect(stillExists).toBeDefined();
    });
  });

  describe("cancel on login", () => {
    it("cancels a pending deletion when the user makes an authenticated request", async () => {
      const [user] = await db
        .select()
        .from(schema.users)
        .where(eq(schema.users.externalId, "user-1"))
        .limit(1);

      const futureDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
      await db.insert(schema.deletionQueue).values({
        id: crypto.randomUUID(),
        userId: user.id,
        scheduledDeleteAt: futureDate,
      });

      // Any authenticated request triggers the cancel logic in auth middleware
      await fetch(`${server.url}/rpc/auth/me`, {
        headers: { Authorization: `Bearer ${user1Token}` },
      });

      const [entry] = await db
        .select()
        .from(schema.deletionQueue)
        .where(eq(schema.deletionQueue.userId, user.id))
        .limit(1);

      expect(entry.status).toBe("canceled");

      // Running the cron job should not delete the user
      const deleted = await processAccountDeletions(db);
      expect(deleted).toBe(0);

      const [stillExists] = await db
        .select()
        .from(schema.users)
        .where(eq(schema.users.id, user.id))
        .limit(1);
      expect(stillExists).toBeDefined();
    });
  });
});
