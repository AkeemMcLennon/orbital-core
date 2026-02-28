import {
  createContact,
  createRelationship,
  listContactRelationships,
  updateRelationship,
  deleteRelationship,
  listAllRelationships,
  initializeApiClient,
} from "@orbital/client";
import { backend } from "@orbital/testing";
import { createTestToken } from "@orbital/testing/backend/auth";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "bun:test";
import { loadSettings } from "../../src/config";
import type { DatabaseClient } from "../../src/database/client";
import * as schema from "../../src/database/schema";
import { startServer } from "../../src/server";

type TestServer = backend.TestServer;

describe("Relationships API", () => {
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

  afterAll(async () => {
    server.stop();
  });

  beforeEach(async () => {
    await backend.clearDatabase(db, { schema });
    await backend.seedTestUser(db, "user-1", { schema });
    await backend.seedTestUser(db, "user-2", { schema });
  });

  // Helper to create two contacts for user-1
  async function createTwoContacts() {
    const r1 = await createContact({ name: "Alice" });
    const r2 = await createContact({ name: "Bob" });
    if (r1.status !== 200 || r2.status !== 200) {
      throw new Error("Failed to create test contacts");
    }
    return { alice: r1.data, bob: r2.data };
  }

  describe("POST /rpc/contacts/relationships", () => {
    it("should create a relationship between two contacts", async () => {
      const { alice, bob } = await createTwoContacts();

      const response = await createRelationship({
        contactId: alice.id,
        relatedContactId: bob.id,
        type: "friend",
        sentiment: 2,
        description: "Met on a ski trip",
      });

      expect(response.status).toBe(200);
      if (response.status !== 200) throw new Error("Expected 200");

      expect(response.data.contactId).toBe(alice.id);
      expect(response.data.relatedContactId).toBe(bob.id);
      expect(response.data.type).toBe("friend");
      expect(response.data.sentiment).toBe(2);
      expect(response.data.description).toBe("Met on a ski trip");
      expect(response.data.mirrorId).toBeDefined();
    });

    it("should create with default neutral sentiment", async () => {
      const { alice, bob } = await createTwoContacts();

      const response = await createRelationship({
        contactId: alice.id,
        relatedContactId: bob.id,
        type: "colleague",
      });

      expect(response.status).toBe(200);
      if (response.status !== 200) throw new Error("Expected 200");
      expect(response.data.sentiment).toBe(0);
    });

    it("should reject self-relationships", async () => {
      const { alice } = await createTwoContacts();

      const response = await createRelationship({
        contactId: alice.id,
        relatedContactId: alice.id,
        type: "friend",
      });

      expect(response.status).toBe(400);
    });

    it("should reject duplicate relationships", async () => {
      const { alice, bob } = await createTwoContacts();

      await createRelationship({
        contactId: alice.id,
        relatedContactId: bob.id,
        type: "friend",
      });

      const response = await createRelationship({
        contactId: alice.id,
        relatedContactId: bob.id,
        type: "colleague",
      });

      expect(response.status).toBe(409);
    });

    it("should reject non-existent contact", async () => {
      const { alice } = await createTwoContacts();

      const response = await createRelationship({
        contactId: alice.id,
        relatedContactId: "1111111111111111",
        type: "friend",
      });

      expect(response.status).toBe(404);
    });

    it("should reject relationship with another user's contact", async () => {
      const { alice } = await createTwoContacts();

      // Create contact as user-2
      const r = await createContact(
        { name: "Charlie" },
        { headers: { Authorization: `Bearer ${user2Token}` } },
      );
      if (r.status !== 200) throw new Error("Failed to create contact");

      const response = await createRelationship({
        contactId: alice.id,
        relatedContactId: r.data.id,
        type: "friend",
      });

      expect(response.status).toBe(404);
    });

    it("should support negative sentiment", async () => {
      const { alice, bob } = await createTwoContacts();

      const response = await createRelationship({
        contactId: alice.id,
        relatedContactId: bob.id,
        type: "rival",
        sentiment: -2,
        description: "Had a fight over business deal",
      });

      expect(response.status).toBe(200);
      if (response.status !== 200) throw new Error("Expected 200");
      expect(response.data.sentiment).toBe(-2);
      expect(response.data.type).toBe("rival");
    });
  });

  describe("GET /rpc/contacts/{id}/relationships", () => {
    it("should list relationships for a contact", async () => {
      const { alice, bob } = await createTwoContacts();
      const r3 = await createContact({ name: "Charlie" });
      if (r3.status !== 200) throw new Error("Failed to create contact");
      const charlie = r3.data;

      await createRelationship({
        contactId: alice.id,
        relatedContactId: bob.id,
        type: "friend",
      });
      await createRelationship({
        contactId: alice.id,
        relatedContactId: charlie.id,
        type: "colleague",
      });

      const response = await listContactRelationships(alice.id);

      expect(response.status).toBe(200);
      if (response.status !== 200) throw new Error("Expected 200");

      expect(response.data.items).toHaveLength(2);
      expect(response.data.pagination.total).toBe(2);
    });

    it("should include related contact info", async () => {
      const { alice, bob } = await createTwoContacts();

      await createRelationship({
        contactId: alice.id,
        relatedContactId: bob.id,
        type: "friend",
      });

      const response = await listContactRelationships(alice.id);

      expect(response.status).toBe(200);
      if (response.status !== 200) throw new Error("Expected 200");

      const rel = response.data.items[0];
      expect(rel.relatedContact).toBeDefined();
      expect(rel.relatedContact?.name).toBe("Bob");
    });

    it("should show mirror relationships (Bob sees Alice)", async () => {
      const { alice, bob } = await createTwoContacts();

      await createRelationship({
        contactId: alice.id,
        relatedContactId: bob.id,
        type: "friend",
      });

      // Bob should also see the relationship
      const response = await listContactRelationships(bob.id);

      expect(response.status).toBe(200);
      if (response.status !== 200) throw new Error("Expected 200");

      expect(response.data.items).toHaveLength(1);
      expect(response.data.items[0].relatedContact?.name).toBe("Alice");
    });

    it("should return 404 for non-existent contact", async () => {
      const response = await listContactRelationships("1111111111111111");
      expect(response.status).toBe(404);
    });

    it("should support pagination", async () => {
      const { alice } = await createTwoContacts();

      // Create multiple contacts and relationships
      for (let i = 0; i < 5; i++) {
        const r = await createContact({ name: `Person ${i}` });
        if (r.status !== 200) throw new Error("Failed to create contact");
        await createRelationship({
          contactId: alice.id,
          relatedContactId: r.data.id,
          type: "friend",
        });
      }

      const page1 = await listContactRelationships(alice.id, { limit: 2, offset: 0 });
      const page2 = await listContactRelationships(alice.id, { limit: 2, offset: 2 });

      if (page1.status !== 200 || page2.status !== 200) {
        throw new Error("Expected 200");
      }

      expect(page1.data.items).toHaveLength(2);
      expect(page2.data.items).toHaveLength(2);
      expect(page1.data.pagination.total).toBe(5);
      expect(page1.data.items[0].id).not.toBe(page2.data.items[0].id);
    });
  });

  describe("PUT /rpc/contacts/relationships/{id}", () => {
    it("should update relationship type and sentiment", async () => {
      const { alice, bob } = await createTwoContacts();

      const created = await createRelationship({
        contactId: alice.id,
        relatedContactId: bob.id,
        type: "acquaintance",
        sentiment: 0,
      });
      if (created.status !== 200) throw new Error("Expected 200");

      const response = await updateRelationship(created.data.id, {
        type: "friend",
        sentiment: 2,
        description: "Got closer over time",
      });

      expect(response.status).toBe(200);
      if (response.status !== 200) throw new Error("Expected 200");

      expect(response.data.type).toBe("friend");
      expect(response.data.sentiment).toBe(2);
      expect(response.data.description).toBe("Got closer over time");
    });

    it("should update mirror row too", async () => {
      const { alice, bob } = await createTwoContacts();

      const created = await createRelationship({
        contactId: alice.id,
        relatedContactId: bob.id,
        type: "acquaintance",
      });
      if (created.status !== 200) throw new Error("Expected 200");

      await updateRelationship(created.data.id, {
        type: "friend",
        sentiment: 2,
      });

      // Check from Bob's perspective
      const bobRels = await listContactRelationships(bob.id);
      if (bobRels.status !== 200) throw new Error("Expected 200");

      expect(bobRels.data.items[0].type).toBe("friend");
      expect(bobRels.data.items[0].sentiment).toBe(2);
    });

    it("should return 404 for non-existent relationship", async () => {
      const response = await updateRelationship("1111111111111111", {
        type: "friend",
      });
      expect(response.status).toBe(404);
    });

    it("should prevent updating another user's relationship", async () => {
      const { alice, bob } = await createTwoContacts();

      const created = await createRelationship({
        contactId: alice.id,
        relatedContactId: bob.id,
        type: "friend",
      });
      if (created.status !== 200) throw new Error("Expected 200");

      const response = await updateRelationship(
        created.data.id,
        { type: "enemy" },
        { headers: { Authorization: `Bearer ${user2Token}` } },
      );

      expect(response.status).toBe(404);
    });
  });

  describe("DELETE /rpc/contacts/relationships/{id}", () => {
    it("should delete a relationship and its mirror", async () => {
      const { alice, bob } = await createTwoContacts();

      const created = await createRelationship({
        contactId: alice.id,
        relatedContactId: bob.id,
        type: "friend",
      });
      if (created.status !== 200) throw new Error("Expected 200");

      const response = await deleteRelationship(created.data.id);
      expect(response.status).toBe(200);

      // Both sides should be gone
      const aliceRels = await listContactRelationships(alice.id);
      const bobRels = await listContactRelationships(bob.id);

      if (aliceRels.status !== 200 || bobRels.status !== 200) {
        throw new Error("Expected 200");
      }

      expect(aliceRels.data.items).toHaveLength(0);
      expect(bobRels.data.items).toHaveLength(0);
    });

    it("should return 404 for non-existent relationship", async () => {
      const response = await deleteRelationship("1111111111111111");
      expect(response.status).toBe(404);
    });

    it("should prevent deleting another user's relationship", async () => {
      const { alice, bob } = await createTwoContacts();

      const created = await createRelationship({
        contactId: alice.id,
        relatedContactId: bob.id,
        type: "friend",
      });
      if (created.status !== 200) throw new Error("Expected 200");

      const response = await deleteRelationship(created.data.id, undefined, {
        headers: { Authorization: `Bearer ${user2Token}` },
      });

      expect(response.status).toBe(404);

      // Verify still exists for user-1
      const check = await listContactRelationships(alice.id);
      if (check.status !== 200) throw new Error("Expected 200");
      expect(check.data.items).toHaveLength(1);
    });
  });

  describe("GET /rpc/contacts/relationships (network view)", () => {
    it("should list all relationships deduplicated", async () => {
      const { alice, bob } = await createTwoContacts();
      const r3 = await createContact({ name: "Charlie" });
      if (r3.status !== 200) throw new Error("Failed to create contact");

      await createRelationship({
        contactId: alice.id,
        relatedContactId: bob.id,
        type: "friend",
        sentiment: 2,
      });
      await createRelationship({
        contactId: alice.id,
        relatedContactId: r3.data.id,
        type: "colleague",
        sentiment: 0,
      });

      const response = await listAllRelationships();

      expect(response.status).toBe(200);
      if (response.status !== 200) throw new Error("Expected 200");

      // Should only show 2 (not 4, since each relationship has a mirror)
      expect(response.data.items).toHaveLength(2);
      expect(response.data.pagination.total).toBe(2);
    });

    it("should filter by type", async () => {
      const { alice, bob } = await createTwoContacts();
      const r3 = await createContact({ name: "Charlie" });
      if (r3.status !== 200) throw new Error("Failed to create contact");

      await createRelationship({
        contactId: alice.id,
        relatedContactId: bob.id,
        type: "friend",
      });
      await createRelationship({
        contactId: alice.id,
        relatedContactId: r3.data.id,
        type: "colleague",
      });

      const response = await listAllRelationships({ type: "friend" });

      expect(response.status).toBe(200);
      if (response.status !== 200) throw new Error("Expected 200");

      expect(response.data.items).toHaveLength(1);
      expect(response.data.items[0].type).toBe("friend");
    });

    it("should filter by sentiment", async () => {
      const { alice, bob } = await createTwoContacts();
      const r3 = await createContact({ name: "Charlie" });
      if (r3.status !== 200) throw new Error("Failed to create contact");

      await createRelationship({
        contactId: alice.id,
        relatedContactId: bob.id,
        type: "friend",
        sentiment: 2,
      });
      await createRelationship({
        contactId: alice.id,
        relatedContactId: r3.data.id,
        type: "rival",
        sentiment: -2,
      });

      const response = await listAllRelationships({ sentiment: 2 });

      expect(response.status).toBe(200);
      if (response.status !== 200) throw new Error("Expected 200");

      expect(response.data.items).toHaveLength(1);
      expect(response.data.items[0].sentiment).toBe(2);
    });

    it("should enforce user isolation", async () => {
      const { alice, bob } = await createTwoContacts();

      await createRelationship({
        contactId: alice.id,
        relatedContactId: bob.id,
        type: "friend",
      });

      // User-2 should see no relationships
      const response = await listAllRelationships(undefined, {
        headers: { Authorization: `Bearer ${user2Token}` },
      });

      expect(response.status).toBe(200);
      if (response.status !== 200) throw new Error("Expected 200");

      expect(response.data.items).toHaveLength(0);
    });
  });
});
