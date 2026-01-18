import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'bun:test';
import { startTestServer, type TestServer } from '../helpers/server';
import {
  createTestDatabase,
  clearDatabase,
  seedTestUser,
  seedTestContacts,
  seedTestDirectory,
} from '../helpers/database';
import { createTestToken } from '../helpers/jwt';
import type { DatabaseClient } from '../../src/database/client';

describe('Contacts API', () => {
  let server: TestServer;
  let db: DatabaseClient;
  let user1Token: string;
  let user2Token: string;

  beforeAll(async () => {
    db = await createTestDatabase();
    server = await startTestServer();

    // Create tokens for two different users
    user1Token = await createTestToken({
      sub: 'user-1',
      email: 'user1@example.com',
    });

    user2Token = await createTestToken({
      sub: 'user-2',
      email: 'user2@example.com',
    });
  });

  afterAll(async () => {
    server.stop();
  });

  beforeEach(async () => {
    await clearDatabase(db);
    await seedTestUser(db, 'user-1');
    await seedTestUser(db, 'user-2');
  });

  describe('POST /rpc/contacts', () => {
    it('should create a new contact', async () => {
      const newContact = {
        name: 'John Doe',
        email: 'john@example.com',
        phone: '+1234567890',
        company: 'Acme Inc',
        jobTitle: 'CEO',
        group: 'work',
      };

      const response = await fetch(`${server.url}/rpc/contacts`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${user1Token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newContact),
      });

      expect(response.status).toBe(200);

      const contact = await response.json();
      expect(contact).toMatchObject({
        name: 'John Doe',
        email: 'john@example.com',
        phone: '+1234567890',
        company: 'Acme Inc',
        jobTitle: 'CEO',
        group: 'work',
      });
      expect(contact.id).toBeDefined();
      expect(contact.createdAt).toBeDefined();
      expect(contact.updatedAt).toBeDefined();
    });

    it('should create contact with minimal fields', async () => {
      const response = await fetch(`${server.url}/rpc/contacts`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${user1Token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: 'Jane Doe' }),
      });

      expect(response.status).toBe(200);

      const contact = await response.json();
      expect(contact.name).toBe('Jane Doe');
    });

    it('should reject invalid email format', async () => {
      const response = await fetch(`${server.url}/rpc/contacts`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${user1Token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: 'Invalid Email',
          email: 'not-an-email',
        }),
      });

      expect(response.status).toBe(400);
    });

    it('should reject missing name field', async () => {
      const response = await fetch(`${server.url}/rpc/contacts`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${user1Token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: 'test@example.com' }),
      });

      expect(response.status).toBe(400);
    });
  });

  describe('GET /rpc/contacts', () => {
    beforeEach(async () => {
      await seedTestContacts(db, 'user-1', 10);
      await seedTestContacts(db, 'user-2', 5);
    });

    it('should list contacts for authenticated user only', async () => {
      const response = await fetch(`${server.url}/rpc/contacts`, {
        headers: {
          Authorization: `Bearer ${user1Token}`,
        },
      });

      expect(response.status).toBe(200);

      const contacts = await response.json();
      expect(contacts).toHaveLength(10); // Only user-1's contacts
      // All contacts should have the same userId (the database UUID for user-1)
      const firstUserId = contacts[0].userId;
      contacts.forEach((contact: any) => {
        expect(contact.userId).toBe(firstUserId);
      });
    });

    it('should filter by group', async () => {
      const response = await fetch(
        `${server.url}/rpc/contacts?group=work`,
        {
          headers: {
            Authorization: `Bearer ${user1Token}`,
          },
        }
      );

      expect(response.status).toBe(200);

      const contacts = await response.json();
      contacts.forEach((contact: any) => {
        expect(contact.group).toBe('work');
      });
    });

    it('should support pagination with limit and offset', async () => {
      const response1 = await fetch(
        `${server.url}/rpc/contacts?limit=3&offset=0`,
        {
          headers: {
            Authorization: `Bearer ${user1Token}`,
          },
        }
      );

      const page1 = await response1.json();
      expect(page1).toHaveLength(3);

      const response2 = await fetch(
        `${server.url}/rpc/contacts?limit=3&offset=3`,
        {
          headers: {
            Authorization: `Bearer ${user1Token}`,
          },
        }
      );

      const page2 = await response2.json();
      expect(page2).toHaveLength(3);

      // Ensure different results
      expect(page1[0].id).not.toBe(page2[0].id);
    });

    it('should respect maximum limit of 100', async () => {
      const response = await fetch(
        `${server.url}/rpc/contacts?limit=200`,
        {
          headers: {
            Authorization: `Bearer ${user1Token}`,
          },
        }
      );

      expect(response.status).toBe(400); // Validation error
    });
  });

  describe('GET /rpc/contacts/{id}', () => {
    let contactId: string;

    beforeEach(async () => {
      // Create a contact for user-1
      const response = await fetch(`${server.url}/rpc/contacts`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${user1Token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: 'Test Contact' }),
      });

      const contact = await response.json();
      contactId = contact.id;
    });

    it('should retrieve contact by id', async () => {
      const response = await fetch(
        `${server.url}/rpc/contacts/${contactId}`,
        {
          headers: {
            Authorization: `Bearer ${user1Token}`,
          },
        }
      );

      expect(response.status).toBe(200);

      const contact = await response.json();
      expect(contact.id).toBe(contactId);
      expect(contact.name).toBe('Test Contact');
    });

    it('should return 404 for non-existent contact', async () => {
      const fakeId = '1111111111111111'; // Valid Base58 encoded zero UUID

      const response = await fetch(
        `${server.url}/rpc/contacts/${fakeId}`,
        {
          headers: {
            Authorization: `Bearer ${user1Token}`,
          },
        }
      );

      expect(response.status).toBe(404);
    });

    it('should prevent access to other users contacts', async () => {
      // User-2 tries to access user-1's contact
      const response = await fetch(
        `${server.url}/rpc/contacts/${contactId}`,
        {
          headers: {
            Authorization: `Bearer ${user2Token}`,
          },
        }
      );

      expect(response.status).toBe(404); // Returns 404, not 403 (security best practice)
    });

    it('should return 400 for invalid Base58 ID', async () => {
      const response = await fetch(
        `${server.url}/rpc/contacts/invalid-id`,
        {
          headers: {
            Authorization: `Bearer ${user1Token}`,
          },
        }
      );

      // Invalid Base58 is caught by validation = 400
      expect(response.status).toBe(400);
    });
  });

  describe('PUT /rpc/contacts/{id}', () => {
    let contactId: string;

    beforeEach(async () => {
      const response = await fetch(`${server.url}/rpc/contacts`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${user1Token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: 'Original Name',
          email: 'original@example.com',
          status: 'available',
        }),
      });

      const contact = await response.json();
      contactId = contact.id;
    });

    it('should update contact fields', async () => {
      const response = await fetch(
        `${server.url}/rpc/contacts/${contactId}`,
        {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${user1Token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            id: contactId,
            name: 'Updated Name',
          }),
        }
      );

      expect(response.status).toBe(200);

      const updated = await response.json();
      expect(updated.name).toBe('Updated Name');
      expect(updated.email).toBe('original@example.com'); // Unchanged
    });

    it('should update only provided fields', async () => {
      const response = await fetch(
        `${server.url}/rpc/contacts/${contactId}`,
        {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${user1Token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            id: contactId,
            company: 'New Company',
          }),
        }
      );

      expect(response.status).toBe(200);

      const updated = await response.json();
      expect(updated.company).toBe('New Company');
      expect(updated.name).toBe('Original Name'); // Unchanged
    });

    it('should return 404 when updating non-existent contact', async () => {
      const fakeId = '1111111111111111'; // Valid Base58 encoded zero UUID

      const response = await fetch(
        `${server.url}/rpc/contacts/${fakeId}`,
        {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${user1Token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            id: fakeId,
            name: 'Updated',
          }),
        }
      );

      expect(response.status).toBe(404);
    });

    it('should prevent updating other users contacts', async () => {
      const response = await fetch(
        `${server.url}/rpc/contacts/${contactId}`,
        {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${user2Token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            id: contactId,
            name: 'Hacked',
          }),
        }
      );

      expect(response.status).toBe(404); // Security: return 404, not 403
    });
  });

  describe('DELETE /rpc/contacts/{id}', () => {
    let contactId: string;

    beforeEach(async () => {
      const response = await fetch(`${server.url}/rpc/contacts`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${user1Token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: 'To Be Deleted' }),
      });

      const contact = await response.json();
      contactId = contact.id;
    });

    it('should delete contact', async () => {
      const response = await fetch(
        `${server.url}/rpc/contacts/${contactId}`,
        {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${user1Token}`,
          },
        }
      );

      expect(response.status).toBe(200);

      const result = await response.json();
      expect(result.success).toBe(true);

      // Verify contact is deleted
      const getResponse = await fetch(
        `${server.url}/rpc/contacts/${contactId}`,
        {
          headers: {
            Authorization: `Bearer ${user1Token}`,
          },
        }
      );

      expect(getResponse.status).toBe(404);
    });

    it('should return 404 when deleting non-existent contact', async () => {
      const fakeId = '1111111111111111'; // Valid Base58 encoded zero UUID

      const response = await fetch(
        `${server.url}/rpc/contacts/${fakeId}`,
        {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${user1Token}`,
          },
        }
      );

      expect(response.status).toBe(404);
    });

    it('should prevent deleting other users contacts', async () => {
      const response = await fetch(
        `${server.url}/rpc/contacts/${contactId}`,
        {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${user2Token}`,
          },
        }
      );

      expect(response.status).toBe(404);

      // Verify contact still exists for user-1
      const getResponse = await fetch(
        `${server.url}/rpc/contacts/${contactId}`,
        {
          headers: {
            Authorization: `Bearer ${user1Token}`,
          },
        }
      );

      expect(getResponse.status).toBe(200);
    });
  });

  describe('User Isolation', () => {
    it('should enforce complete user isolation across all operations', async () => {
      // User-1 creates contacts
      const user1Contacts = [];
      for (let i = 0; i < 3; i++) {
        const response = await fetch(`${server.url}/rpc/contacts`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${user1Token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ name: `User1 Contact ${i}` }),
        });
        const contact = await response.json();
        user1Contacts.push(contact);
      }

      // User-2 creates contacts
      const user2Contacts = [];
      for (let i = 0; i < 3; i++) {
        const response = await fetch(`${server.url}/rpc/contacts`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${user2Token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ name: `User2 Contact ${i}` }),
        });
        const contact = await response.json();
        user2Contacts.push(contact);
      }

      // User-1 can only see their contacts
      const user1List = await fetch(`${server.url}/rpc/contacts`, {
        headers: { Authorization: `Bearer ${user1Token}` },
      });
      const user1Data = await user1List.json();
      expect(user1Data).toHaveLength(3);
      // All user1's contacts should have the same userId
      const user1Id = user1Contacts[0].userId;
      expect(user1Data.every((c: any) => c.userId === user1Id)).toBe(true);

      // User-2 can only see their contacts
      const user2List = await fetch(`${server.url}/rpc/contacts`, {
        headers: { Authorization: `Bearer ${user2Token}` },
      });
      const user2Data = await user2List.json();
      expect(user2Data).toHaveLength(3);
      // All user2's contacts should have the same userId
      const user2Id = user2Contacts[0].userId;
      expect(user2Data.every((c: any) => c.userId === user2Id)).toBe(true);

      // User-2 cannot access User-1's contacts
      for (const contact of user1Contacts) {
        const response = await fetch(
          `${server.url}/rpc/contacts/${contact.id}`,
          {
            headers: { Authorization: `Bearer ${user2Token}` },
          }
        );
        expect(response.status).toBe(404);
      }
    });
  });

  describe('GET /rpc/contacts/search/managed', () => {
    beforeEach(async () => {
      await seedTestContacts(db, 'user-1', 5);
      await seedTestContacts(db, 'user-2', 3);
    });

    it('should search contacts by name', async () => {
      const response = await fetch(
        `${server.url}/rpc/contacts/search/managed?query=Contact%202`,
        {
          headers: {
            Authorization: `Bearer ${user1Token}`,
          },
        }
      );

      expect(response.status).toBe(200);

      const results = await response.json();
      expect(results).toHaveLength(1);
      expect(results[0].name).toContain('Contact 2');
    });

    it('should search contacts by email', async () => {
      const response = await fetch(
        `${server.url}/rpc/contacts/search/managed?query=contact3%40example.com`,
        {
          headers: {
            Authorization: `Bearer ${user1Token}`,
          },
        }
      );

      expect(response.status).toBe(200);

      const results = await response.json();
      expect(results).toHaveLength(1);
      expect(results[0].email).toContain('contact3@example.com');
    });

    it('should support pagination in search results', async () => {
      const response1 = await fetch(
        `${server.url}/rpc/contacts/search/managed?query=Contact&limit=2&offset=0`,
        {
          headers: {
            Authorization: `Bearer ${user1Token}`,
          },
        }
      );

      const page1 = await response1.json();
      expect(page1.length).toBeLessThanOrEqual(2);

      const response2 = await fetch(
        `${server.url}/rpc/contacts/search/managed?query=Contact&limit=2&offset=2`,
        {
          headers: {
            Authorization: `Bearer ${user1Token}`,
          },
        }
      );

      const page2 = await response2.json();
      // Results should be different or second page should be smaller
      if (page1.length === 2 && page2.length > 0) {
        expect(page1[0].id).not.toBe(page2[0].id);
      }
    });

    it('should return empty results for non-matching query', async () => {
      const response = await fetch(
        `${server.url}/rpc/contacts/search/managed?query=NonExistent`,
        {
          headers: {
            Authorization: `Bearer ${user1Token}`,
          },
        }
      );

      expect(response.status).toBe(200);

      const results = await response.json();
      expect(results).toHaveLength(0);
    });

    it('should enforce user isolation in search', async () => {
      const response = await fetch(
        `${server.url}/rpc/contacts/search/managed?query=Contact`,
        {
          headers: {
            Authorization: `Bearer ${user2Token}`,
          },
        }
      );

      expect(response.status).toBe(200);

      const results = await response.json();
      // User-2 should only see their own contacts (3 total)
      expect(results.length).toBeLessThanOrEqual(3);
    });

    it('should reject empty query string', async () => {
      const response = await fetch(
        `${server.url}/rpc/contacts/search/managed?query=`,
        {
          headers: {
            Authorization: `Bearer ${user1Token}`,
          },
        }
      );

      expect(response.status).toBe(400); // Validation error
    });
  });

  describe('GET /rpc/contacts/available', () => {
    beforeEach(async () => {
      await seedTestDirectory(db, 'user-1', 8);
      await seedTestDirectory(db, 'user-2', 4);
    });

    it('should list available contacts from directory', async () => {
      const response = await fetch(`${server.url}/rpc/contacts/available`, {
        headers: {
          Authorization: `Bearer ${user1Token}`,
        },
      });

      expect(response.status).toBe(200);

      const available = await response.json();
      expect(available.length).toBeGreaterThan(0);
      // Verify all entries have activeContactId as null
      available.forEach((entry: any) => {
        expect(entry.activeContactId).toBeNull();
      });
    });

    it('should support pagination for available contacts', async () => {
      const response1 = await fetch(
        `${server.url}/rpc/contacts/available?limit=3&offset=0`,
        {
          headers: {
            Authorization: `Bearer ${user1Token}`,
          },
        }
      );

      const page1 = await response1.json();
      expect(page1.length).toBeLessThanOrEqual(3);

      const response2 = await fetch(
        `${server.url}/rpc/contacts/available?limit=3&offset=3`,
        {
          headers: {
            Authorization: `Bearer ${user1Token}`,
          },
        }
      );

      const page2 = await response2.json();
      if (page1.length === 3 && page2.length > 0) {
        expect(page1[0].id).not.toBe(page2[0].id);
      }
    });

    it('should enforce user isolation for available contacts', async () => {
      const response1 = await fetch(`${server.url}/rpc/contacts/available`, {
        headers: {
          Authorization: `Bearer ${user1Token}`,
        },
      });

      const user1Available = await response1.json();

      const response2 = await fetch(`${server.url}/rpc/contacts/available`, {
        headers: {
          Authorization: `Bearer ${user2Token}`,
        },
      });

      const user2Available = await response2.json();

      // User-1 should have 8, user-2 should have 4
      expect(user1Available.length).toBe(8);
      expect(user2Available.length).toBe(4);
    });
  });

  describe('GET /rpc/contacts/search/available', () => {
    beforeEach(async () => {
      await seedTestDirectory(db, 'user-1', 6);
      await seedTestDirectory(db, 'user-2', 3);
    });

    it('should search available contacts by name', async () => {
      const response = await fetch(
        `${server.url}/rpc/contacts/search/available?query=Available%20Contact%202`,
        {
          headers: {
            Authorization: `Bearer ${user1Token}`,
          },
        }
      );

      expect(response.status).toBe(200);

      const results = await response.json();
      expect(results.length).toBeGreaterThan(0);
      results.forEach((entry: any) => {
        expect(entry.name).toContain('Available Contact 2');
      });
    });

    it('should search available contacts by company', async () => {
      const response = await fetch(
        `${server.url}/rpc/contacts/search/available?query=Company%20A`,
        {
          headers: {
            Authorization: `Bearer ${user1Token}`,
          },
        }
      );

      expect(response.status).toBe(200);

      const results = await response.json();
      expect(results.length).toBeGreaterThan(0);
      results.forEach((entry: any) => {
        expect(entry.company).toBe('Company A');
      });
    });

    it('should support pagination in available search', async () => {
      const response1 = await fetch(
        `${server.url}/rpc/contacts/search/available?query=Available&limit=2&offset=0`,
        {
          headers: {
            Authorization: `Bearer ${user1Token}`,
          },
        }
      );

      const page1 = await response1.json();
      expect(page1.length).toBeLessThanOrEqual(2);

      const response2 = await fetch(
        `${server.url}/rpc/contacts/search/available?query=Available&limit=2&offset=2`,
        {
          headers: {
            Authorization: `Bearer ${user1Token}`,
          },
        }
      );

      const page2 = await response2.json();
      if (page1.length === 2 && page2.length > 0) {
        expect(page1[0].id).not.toBe(page2[0].id);
      }
    });

    it('should only return available (non-promoted) contacts', async () => {
      const response = await fetch(
        `${server.url}/rpc/contacts/search/available?query=Available`,
        {
          headers: {
            Authorization: `Bearer ${user1Token}`,
          },
        }
      );

      expect(response.status).toBe(200);

      const results = await response.json();
      results.forEach((entry: any) => {
        expect(entry.activeContactId).toBeNull();
      });
    });

    it('should enforce user isolation in available search', async () => {
      const response = await fetch(
        `${server.url}/rpc/contacts/search/available?query=Available`,
        {
          headers: {
            Authorization: `Bearer ${user2Token}`,
          },
        }
      );

      expect(response.status).toBe(200);

      const results = await response.json();
      // User-2 should only see their own available contacts (max 3)
      expect(results.length).toBeLessThanOrEqual(3);
    });
  });
});
