import {
  createContact,
  getContactById,
  getContacts,
  updateContact,
  initializeApiClient,
  deleteContact,
  searchContacts,
  getAvailableContacts,
  searchAvailableContacts,
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

describe("Contacts API", () => {
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

    // Initialize client with test server URL

    // Create tokens for two different users
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

  describe("POST /rpc/contacts", () => {
    it("should create a new contact", async () => {
      const newContact = {
        name: "John Doe",
        email: "john@example.com",
        phone: "+1234567890",
        company: "Acme Inc",
        jobTitle: "CEO",
        group: "work",
      };

      const response = await createContact(newContact);

      if (response.status !== 200) {
        throw new Error("Expected 200 response from contacts");
      }

      const response2 = await getContactById(response?.data.id);
      if (response2.status !== 200) {
        throw new Error("Expected 200 response from contacts");
      }

      const contact = response2.data;
      expect(contact).toMatchObject({
        name: "John Doe",
        email: "john@example.com",
        phone: "+1234567890",
        company: "Acme Inc",
        jobTitle: "CEO",
        group: "work",
      });
      expect(contact.id).toBeDefined();
      expect(contact.createdAt).toBeDefined();
      expect(contact.updatedAt).toBeDefined();
    });

    it("should create contact with minimal fields", async () => {
      // Use generated client
      const response = await createContact({ name: "Jane Doe" });

      expect(response.status).toBe(200);
      if (response.status !== 200) {
        throw new Error("Expected 200 response from contacts");
      }

      const contact = response.data;
      expect(contact.name).toBe("Jane Doe");
    });

    it("should reject missing name field", async () => {
      const response = await createContact({
        email: "test@example.com",
        name: "",
      });

      expect(response.status).toBe(400);
    });
  });

  describe("GET /rpc/contacts", () => {
    beforeEach(async () => {
      await backend.seedTestContacts(db, "user-1", { schema }, 10);
      await backend.seedTestContacts(db, "user-2", { schema }, 5);
    });

    it("should list contacts for authenticated user only", async () => {
      // Use generated client
      const response = await getContacts();

      if (response.status !== 200) {
        throw new Error("Expected 200 response from api");
      }

      const contacts = response.data.items;
      expect(contacts).toHaveLength(10); // Only user-1's contacts
      expect(response.data.pagination.total).toBe(10);
      // All contacts should have the same userId (the database UUID for user-1)
      const firstUserId = contacts[0].userId;
      contacts.forEach((contact) => {
        expect(contact.userId).toBe(firstUserId);
      });
    });

    it("should filter by group", async () => {
      // Use generated client with params
      const response = await getContacts({ group: "work" });

      if (response.status !== 200) {
        throw new Error("Expected 200 response from api");
      }

      const contacts = response.data.items;
      contacts.forEach((contact) => {
        expect(contact.group).toBe("work");
      });
    });

    it("should support pagination with limit and offset", async () => {
      // Use generated client with pagination params
      const response1 = await getContacts({ limit: 3, offset: 0 });
      if (response1.status !== 200) {
        throw new Error("Expected 200 response from api");
      }

      const page1 = response1.data.items;
      expect(page1).toHaveLength(3);
      expect(response1.data.pagination.total).toBe(10);

      const response2 = await getContacts({ limit: 3, offset: 3 });
      if (response2.status !== 200) {
        throw new Error("Expected 200 response from api");
      }

      const page2 = response2.data.items;
      expect(page2).toHaveLength(3);

      // Ensure different results
      expect(page1[0].id).not.toBe(page2[0].id);
    });

    it("should sort contacts by lastInteractionAt falling back to createdAt by default", async () => {
      // Clear existing contacts to have a clean slate for this test
      await backend.clearDatabase(db, { schema });
      await backend.seedTestUser(db, "user-1", { schema });

      // Get user ID
      const [user] = await db
        .select()
        .from(schema.users)
        .where(eq(schema.users.externalId, "user-1"))
        .limit(1);

      const now = new Date();
      const oneDayAgo = new Date(now.getTime() - 86400000);
      const twoDaysAgo = new Date(now.getTime() - 86400000 * 2);
      const threeDaysAgo = new Date(now.getTime() - 86400000 * 3);

      // Contact 1: Created 3 days ago, Interaction Today (Effective: Today)
      await db.insert(schema.contacts).values({
        userId: user.id,
        name: "Contact 1",
        createdAt: threeDaysAgo,
        updatedAt: threeDaysAgo,
        lastInteractionAt: now,
      });

      // Contact 2: Created Yesterday, No Interaction (Effective: Yesterday)
      await db.insert(schema.contacts).values({
        userId: user.id,
        name: "Contact 2",
        createdAt: oneDayAgo,
        updatedAt: oneDayAgo,
        lastInteractionAt: null,
      });

      // Contact 3: Created 2 days ago, No Interaction (Effective: 2 days ago)
      await db.insert(schema.contacts).values({
        userId: user.id,
        name: "Contact 3",
        createdAt: twoDaysAgo,
        updatedAt: twoDaysAgo,
        lastInteractionAt: null,
      });

      // Test Default Sort (Recency)
      const responseDefault = await getContacts();
      expect(responseDefault.status).toBe(200);
      if (responseDefault.status === 200) {
        const defaultOrder = responseDefault.data.items.map((c) => c.name);
        expect(defaultOrder).toEqual(["Contact 1", "Contact 2", "Contact 3"]);
      }

      const responseDate = await getContacts({ sort: "date" });
      expect(responseDate.status).toBe(200);
      if (responseDate.status === 200) {
        const dateOrder = responseDefault.data.items.map((c) => c.name);
        expect(dateOrder).toEqual(["Contact 1", "Contact 2", "Contact 3"]);
      }
    });
  });

  describe("GET /rpc/contacts/{id}", () => {
    let contactId: string;

    beforeEach(async () => {
      // Create a contact for user-1
      const response = await createContact({ name: "Test Contact" });

      if (response.status === 200) {
        const contact = response.data;
        contactId = contact.id;
      }
    });

    it("should retrieve contact by id", async () => {
      const response = await getContactById(contactId);

      expect(response.status).toBe(200);

      if (response.status !== 200) {
        throw new Error("Expected 200 response from api");
      }

      const contact = response.data;
      expect(contact.id).toBe(contactId);
      expect(contact.name).toBe("Test Contact");
    });

    it("should return 404 for non-existent contact", async () => {
      const fakeId = "1111111111111111"; // Valid Base58 encoded zero UUID
      const response = await getContactById(fakeId);

      expect(response.status).toBe(404);
    });

    it("should prevent access to other users contacts", async () => {
      // User-2 tries to access user-1's contact
      const response = await getContactById(contactId, {
        headers: {
          Authorization: `Bearer ${user2Token}`,
        },
      });

      expect(response.status).toBe(404); // Returns 404, not 403 (security best practice)
    });
  });

  describe("PUT /rpc/contacts/{id}", () => {
    let contactId: string;

    beforeEach(async () => {
      const response = await createContact({
        name: "Original Name",
        email: "original@example.com",
      });

      if (response.status === 200) {
        const contact = response.data;
        contactId = contact.id;
      }
    });

    it("should update contact fields", async () => {
      let response = await updateContact(contactId, {
        name: "Updated Name",
      });

      expect(response.status).toBe(200);

      response = await getContactById(contactId);
      if (response.status !== 200) {
        throw new Error("Expected 200 response from api");
      }

      const updated = response.data;
      expect(updated.name).toBe("Updated Name");
      expect(updated.email).toBe("original@example.com"); // Unchanged
    });

    it("should return 404 when updating non-existent contact", async () => {
      const fakeId = "1111111111111111"; // Valid Base58 encoded zero UUID

      let response = await updateContact(fakeId, {
        name: "Updated Name",
      });

      expect(response.status).toBe(404);
    });

    it("should prevent updating other users contacts", async () => {
      const response = await updateContact(
        contactId,
        {
          name: "Hacked",
        },
        {
          headers: {
            Authorization: `Bearer ${user2Token}`,
            "Content-Type": "application/json",
          },
        },
      );

      expect(response.status).toBe(404); // Security: return 404, not 403
    });
  });

  describe("DELETE /rpc/contacts/{id}", () => {
    let contactId: string;

    beforeEach(async () => {
      const response = await createContact({ name: "To Be Deleted" });

      if (response.status === 200) {
        const contact = response.data;
        contactId = contact.id;
      }
    });

    it("should delete contact", async () => {
      const response = await deleteContact(contactId);

      expect(response.status).toBe(200);

      // Verify contact is deleted
      const getResponse = await getContactById(contactId);

      expect(getResponse.status).toBe(404);
    });

    it("should return 404 when deleting non-existent contact", async () => {
      const fakeId = "1111111111111111"; // Valid Base58 encoded zero UUID

      const response = await deleteContact(fakeId);

      expect(response.status).toBe(404);
    });

    it("should prevent deleting other users contacts", async () => {
      const response = await deleteContact(contactId, undefined, {
        headers: {
          Authorization: `Bearer ${user2Token}`,
        },
      });
      expect(response.status).toBe(404);

      // Verify contact still exists for user-1
      const getResponse = await getContactById(contactId);

      expect(getResponse.status).toBe(200);
    });
  });

  describe("GET /rpc/contacts/search/managed", () => {
    beforeEach(async () => {
      await backend.seedTestContacts(db, "user-1", { schema }, 5);
      await backend.seedTestContacts(db, "user-2", { schema }, 3);
    });

    it("should search contacts by name", async () => {
      const response = await searchContacts({ query: "Contact 2" });

      expect(response.status).toBe(200);

      if (response.status !== 200) {
        throw new Error("Expected 200 response from api");
      }

      const results = response.data.items;
      expect(results).toHaveLength(1);
      expect(results[0].name).toContain("Contact 2");
    });

    it("should search contacts by email", async () => {
      const response = await searchContacts({
        query: "contact3@example.com",
      });

      expect(response.status).toBe(200);

      if (response.status !== 200) {
        throw new Error("Expected 200 response from api");
      }

      const results = response.data.items;
      expect(results).toHaveLength(1);
      expect(results[0].email).toContain("contact3@example.com");
    });

    it("should support pagination in search results", async () => {
      const response1 = await searchContacts({
        query: "Contact",
        limit: 2,
        offset: 0,
      });

      if (response1.status !== 200) {
        throw new Error("Expected 200 response from api");
      }

      const page1 = response1.data.items;
      expect(page1.length).toBeLessThanOrEqual(2);

      const response2 = await searchContacts({
        query: "Contact",
        limit: 2,
        offset: 2,
      });

      if (response2.status !== 200) {
        throw new Error("Expected 200 response from api");
      }

      const page2 = response2.data.items;
      // Results should be different or second page should be smaller
      if (page1.length === 2 && page2.length > 0) {
        expect(page1[0].id).not.toBe(page2[0].id);
      }
    });

    it("should return empty results for non-matching query", async () => {
      const response = await searchContacts({ query: "NonExistent" });

      expect(response.status).toBe(200);

      if (response.status !== 200) {
        throw new Error("Expected 200 response from api");
      }

      const results = response.data.items;
      expect(results).toHaveLength(0);
      expect(response.data.pagination.total).toBe(0);
    });

    it("should enforce user isolation in search", async () => {
      const response = await searchContacts(
        { query: "Contact" },
        {
          headers: {
            Authorization: `Bearer ${user2Token}`,
          },
        },
      );

      expect(response.status).toBe(200);

      if (response.status !== 200) {
        throw new Error("Expected 200 response from api");
      }

      const results = response.data.items;
      // User-2 should only see their own contacts (3 total)
      expect(results.length).toBeLessThanOrEqual(3);
    });
  });

  describe("GET /rpc/contacts/available", () => {
    beforeEach(async () => {
      await backend.seedTestDirectory(db, "user-1", { schema }, 8);
      await backend.seedTestDirectory(db, "user-2", { schema }, 4);
    });

    it("should list available contacts from directory", async () => {
      const response = await getAvailableContacts();

      expect(response.status).toBe(200);

      if (response.status !== 200) {
        throw new Error("Expected 200 response from api");
      }

      const available = response.data.items;
      expect(available.length).toBeGreaterThan(0);
      // Verify all entries have activeContactId as null
      available.forEach((entry) => {
        expect(entry.activeContactId).toBeNull();
      });
    });

    it("should support pagination for available contacts", async () => {
      const response1 = await getAvailableContacts({ limit: 3, offset: 0 });

      if (response1.status !== 200) {
        throw new Error("Expected 200 response from api");
      }

      const page1 = response1.data.items;
      expect(page1.length).toBeLessThanOrEqual(3);

      const response2 = await getAvailableContacts({ limit: 3, offset: 3 });

      if (response2.status !== 200) {
        throw new Error("Expected 200 response from api");
      }

      const page2 = response2.data.items;
      if (page1.length === 3 && page2.length > 0) {
        expect(page1[0].id).not.toBe(page2[0].id);
      }
    });

    it("should enforce user isolation for available contacts", async () => {
      const response1 = await getAvailableContacts();

      if (response1.status !== 200) {
        throw new Error("Expected 200 response from api");
      }

      const user1Available = response1.data.items;

      const response2 = await getAvailableContacts(undefined, {
        headers: {
          Authorization: `Bearer ${user2Token}`,
        },
      });

      if (response2.status !== 200) {
        throw new Error("Expected 200 response from api");
      }

      const user2Available = response2.data.items;

      // User-1 should have 8, user-2 should have 4
      expect(user1Available.length).toBe(8);
      expect(user2Available.length).toBe(4);
    });
  });

  describe("GET /rpc/contacts/search/available", () => {
    beforeEach(async () => {
      await backend.seedTestDirectory(db, "user-1", { schema }, 6);
      await backend.seedTestDirectory(db, "user-2", { schema }, 3);
    });

    it("should search available contacts by name", async () => {
      const response = await searchAvailableContacts({
        query: "Available Contact 2",
      });

      expect(response.status).toBe(200);

      if (response.status !== 200) {
        throw new Error("Expected 200 response from api");
      }

      const results = response.data.items;
      expect(results.length).toBeGreaterThan(0);
      results.forEach((entry) => {
        expect(entry.name).toContain("Available Contact 2");
      });
    });

    it("should search available contacts by company", async () => {
      const response = await searchAvailableContacts({ query: "Company A" });

      expect(response.status).toBe(200);

      if (response.status !== 200) {
        throw new Error("Expected 200 response from api");
      }

      const results = response.data.items;
      expect(results.length).toBeGreaterThan(0);
      results.forEach((entry) => {
        expect(entry.company).toBe("Company A");
      });
    });

    it("should support pagination in available search", async () => {
      const response1 = await searchAvailableContacts({
        query: "Available",
        limit: 2,
        offset: 0,
      });

      if (response1.status !== 200) {
        throw new Error("Expected 200 response from api");
      }

      const page1 = response1.data.items;
      expect(page1.length).toBeLessThanOrEqual(2);

      const response2 = await searchAvailableContacts({
        query: "Available",
        limit: 2,
        offset: 2,
      });

      if (response2.status !== 200) {
        throw new Error("Expected 200 response from api");
      }

      const page2 = response2.data.items;
      if (page1.length === 2 && page2.length > 0) {
        expect(page1[0].id).not.toBe(page2[0].id);
      }
    });

    it("should only return available (non-promoted) contacts", async () => {
      const response = await searchAvailableContacts({ query: "Available" });

      expect(response.status).toBe(200);

      if (response.status !== 200) {
        throw new Error("Expected 200 response from api");
      }

      const results = response.data.items;
      results.forEach((entry) => {
        expect(entry.activeContactId).toBeNull();
      });
    });

    it("should enforce user isolation in available search", async () => {
      const response = await searchAvailableContacts(
        { query: "Available" },
        {
          headers: {
            Authorization: `Bearer ${user2Token}`,
          },
        },
      );

      expect(response.status).toBe(200);

      if (response.status !== 200) {
        throw new Error("Expected 200 response from api");
      }

      const results = response.data.items;
      // User-2 should only see their own available contacts (max 3)
      expect(results.length).toBeLessThanOrEqual(3);
    });
  });
});
