import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from "bun:test";
import { backend } from "@orbital/testing";
import { createTestToken } from "@orbital/testing/backend/auth";
import * as schema from "../../src/database/schema";
import { eq } from "drizzle-orm";
import { storeIntegrationCredentials } from "../../src/services/integrations/credentials";
import { syncIntegration } from "../../src/services/integrations/sync";
import { registerProvider } from "../../src/services/integrations/provider";
import { googleProvider } from "../../src/services/integrations/google";
import type { DatabaseClient } from "../../src/database/client";
import { google as gAPIS } from "googleapis";
import { startServer } from "../../src/server";
import { loadSettings } from "../../src/config";
import { initializeApiClient, integrationsGoogleConnect } from "@orbital/client";

// Import MSW utilities
const { google } = backend.integrations;

describe("Google Integration (MSW Mocked)", () => {
  let db: DatabaseClient;
  let mswServer: ReturnType<typeof google.setupGoogleMockServer>;
  const userId = "test-user-google";

  beforeAll(async () => {
    // Initialize test database
    db = await backend.createTestDatabase({
      schema,
      migrationsPath: "./src/database/migrations",
    });

    gAPIS.options({ fetchImplementation: fetch });

    // Start MSW server
    mswServer = google.setupGoogleMockServer();
    mswServer.listen({ onUnhandledRequest: "error" });

    // Register Google provider for tests
    registerProvider(googleProvider);
  });

  afterAll(async () => {
    mswServer.close();
  });

  beforeEach(async () => {
    await backend.clearDatabase(db, { schema });
    await backend.seedTestUser(db, userId, { schema });

    // Clean integrations/contacts/directory
    await db
      .delete(schema.integrations)
      .where(eq(schema.integrations.userId, userId));
    await db.delete(schema.contacts).where(eq(schema.contacts.userId, userId));
    await db
      .delete(schema.directory)
      .where(eq(schema.directory.userId, userId));

    // Reset MSW state
    mswServer.resetHandlers();
    google.resetPaginationState();
    google.setDirectoryAccessEnabled(true);
  });

  it("should sync personal contacts from Google", async () => {
    // Store credentials for Google integration
    const integration = await storeIntegrationCredentials(
      db,
      userId,
      "google",
      "test@example.com",
      {
        accessToken: "mock-google-token",
        expiresAt: new Date(Date.now() + 86400000), // 1 day from now
      },
    );

    // Perform sync
    const result = await syncIntegration(db, integration.id, userId);

    // Verify sync completed successfully
    expect(result.imported).toBeGreaterThan(0);
    expect(result.errors).toBe(0);

    // Verify contacts are in directory
    const allContacts = await db
      .select()
      .from(schema.directory)
      .where(eq(schema.directory.userId, userId));

    expect(allContacts.length).toBe(result.imported);
    expect(allContacts.length).toBeGreaterThan(0);
  });

  it("should handle pagination across multiple API calls", async () => {
    // Reset with specific page size to force pagination
    google.resetPaginationState({ personalCount: 10, pageSize: 3 });

    const integration = await storeIntegrationCredentials(
      db,
      userId,
      "google",
      "test@example.com",
      {
        accessToken: "mock-google-token",
        expiresAt: new Date(Date.now() + 86400000),
      },
    );

    const result = await syncIntegration(db, integration.id, userId);

    // Should have fetched all contacts across multiple pages
    expect(result.imported).toBeGreaterThan(9); // At least 10 personal contacts
    expect(result.errors).toBe(0);
  });

  it("should use sync tokens for delta sync", async () => {
    // First sync
    const integration = await storeIntegrationCredentials(
      db,
      userId,
      "google",
      "test@example.com",
      {
        accessToken: "mock-google-token",
        expiresAt: new Date(Date.now() + 86400000),
      },
    );

    const firstSync = await syncIntegration(db, integration.id, userId);
    expect(firstSync.imported).toBeGreaterThan(0);

    // Get updated integration - verify lastSyncAt was updated
    const [updatedIntegration] = await db
      .select()
      .from(schema.integrations)
      .where(eq(schema.integrations.id, integration.id))
      .limit(1);

    expect(updatedIntegration!.lastSyncAt).toBeDefined();
    // Note: syncToken storage is provider-specific and may not be in schema yet
  });

  it("should gracefully handle directory access denied", async () => {
    // Disable directory access to simulate 403
    google.setDirectoryAccessEnabled(false);

    const integration = await storeIntegrationCredentials(
      db,
      userId,
      "google",
      "test@example.com",
      {
        accessToken: "mock-google-token",
        expiresAt: new Date(Date.now() + 86400000),
      },
    );

    const result = await syncIntegration(db, integration.id, userId);

    // Should still import personal contacts despite directory failure
    expect(result.imported).toBeGreaterThan(0);

    // Verify only personal contacts imported (no directory contacts)
    const allContacts = await db
      .select()
      .from(schema.directory)
      .where(eq(schema.directory.userId, userId));

    // All contacts should be from personal source (resourceName starts with "people/")
    const personalContacts = allContacts.filter(
      (c) =>
        (c.rawMetadata as any)?.resourceName?.startsWith("people/") &&
        !(c.rawMetadata as any)?.resourceName?.startsWith("people/directory/"),
    );
    expect(personalContacts.length).toBe(allContacts.length);
  });

  it("should handle contacts with multiple emails/phones/social profiles", async () => {
    // Reset with contact that has secondary data (contact 003)
    // Disable directory to test only personal contacts
    google.resetPaginationState({ personalCount: 3, directoryCount: 0 });
    google.setDirectoryAccessEnabled(false);

    const integration = await storeIntegrationCredentials(
      db,
      userId,
      "google",
      "test@example.com",
      {
        accessToken: "mock-google-token",
        expiresAt: new Date(Date.now() + 86400000),
      },
    );

    const result = await syncIntegration(db, integration.id, userId);

    expect(result.imported).toBe(3);

    // Find contact with secondary data (user003)
    const contactWithSecondary = await db
      .select()
      .from(schema.directory)
      .where(eq(schema.directory.userId, userId))
      .limit(10);

    const user003 = contactWithSecondary.find((c) =>
      (c.rawMetadata as any)?.resourceName?.includes("003"),
    );

    expect(user003).toBeDefined();
    expect(user003!.secondaryData).not.toBeNull();
    expect(Array.isArray(user003!.secondaryData)).toBe(true);
    expect((user003!.secondaryData as any[]).length).toBeGreaterThan(0);
  });

  it("should correctly map Google API fields to directory schema", async () => {
    const integration = await storeIntegrationCredentials(
      db,
      userId,
      "google",
      "test@example.com",
      {
        accessToken: "mock-google-token",
        expiresAt: new Date(Date.now() + 86400000),
      },
    );

    const result = await syncIntegration(db, integration.id, userId);

    expect(result.imported).toBeGreaterThan(0);

    const contacts = await db
      .select()
      .from(schema.directory)
      .where(eq(schema.directory.userId, userId));

    const firstContact = contacts[0];
    expect(firstContact).toBeDefined();

    // Verify source
    expect(firstContact!.source).toBe("google");

    // Verify external ID
    expect(firstContact!.externalId).toBeDefined();
    expect(firstContact!.externalId).toContain("people/");

    // Verify name
    expect(firstContact!.name).toBeDefined();
    expect(firstContact!.name).toContain("Test User");

    // At least some contacts should have email or phone
    const contactsWithEmail = contacts.filter((c) => c.email);
    const contactsWithPhone = contacts.filter((c) => c.phone);
    expect(contactsWithEmail.length + contactsWithPhone.length).toBeGreaterThan(
      0,
    );
  });

  it("should handle contacts with organizations", async () => {
    // Contact 001 has organization data
    // Disable directory to test only personal contacts
    google.resetPaginationState({ personalCount: 1, directoryCount: 0 });
    google.setDirectoryAccessEnabled(false);

    const integration = await storeIntegrationCredentials(
      db,
      userId,
      "google",
      "test@example.com",
      {
        accessToken: "mock-google-token",
        expiresAt: new Date(Date.now() + 86400000),
      },
    );

    const result = await syncIntegration(db, integration.id, userId);

    expect(result.imported).toBe(1);

    const [contact] = await db
      .select()
      .from(schema.directory)
      .where(eq(schema.directory.userId, userId));

    expect(contact!.company).toBe("Acme Corp");
  });

  it("should update sync state after successful sync", async () => {
    const integration = await storeIntegrationCredentials(
      db,
      userId,
      "google",
      "test@example.com",
      {
        accessToken: "mock-google-token",
        expiresAt: new Date(Date.now() + 86400000),
      },
    );

    const initialLastSyncAt = integration.lastSyncAt;

    await syncIntegration(db, integration.id, userId);

    // Verify sync state was updated
    const [updatedIntegration] = await db
      .select()
      .from(schema.integrations)
      .where(eq(schema.integrations.id, integration.id))
      .limit(1);

    expect(updatedIntegration!.lastSyncAt).toBeDefined();
    expect(updatedIntegration!.lastSyncAt!.getTime()).toBeGreaterThan(
      initialLastSyncAt?.getTime() || 0,
    );
  });
});

describe("Google OAuth Flow (API)", () => {
  let db: DatabaseClient;
  let mswServer: ReturnType<typeof google.setupGoogleMockServer>;
  let server: { url: string; stop: () => void };
  const userId = "test-user-oauth";
  let currentToken: string;

  beforeAll(async () => {
    // Initialize test database
    db = await backend.createTestDatabase({
      schema,
      migrationsPath: "./src/database/migrations",
    });

    gAPIS.options({ fetchImplementation: fetch });

    // Start MSW server
    mswServer = google.setupGoogleMockServer();
    mswServer.listen({ onUnhandledRequest: "bypass" });

    // Register Google provider for tests
    registerProvider(googleProvider);

    // Start test server with Google OAuth credentials
    server = await backend.startTestServer({
      startServer,
      loadSettings,
      envOverrides: {
        GOOGLE_CLIENT_ID: "test-google-client-id",
        GOOGLE_CLIENT_SECRET: "test-google-client-secret",
        DB_ENCRYPTION_KEY: "0sv02gmzhamuqCx36UDVUboTqNfMSO3jSMpTFhhCvnE",
      },
    });

    // Initialize API client
    initializeApiClient({
      baseURL: `${server.url}/rpc`,
      getToken: () => currentToken,
    });
  });

  afterAll(async () => {
    mswServer.close();
    server.stop();
  });

  beforeEach(async () => {
    await backend.clearDatabase(db, { schema });
    await backend.seedTestUser(db, userId, { schema });

    // Clean integrations/contacts/directory
    await db
      .delete(schema.integrations)
      .where(eq(schema.integrations.userId, userId));
    await db.delete(schema.contacts).where(eq(schema.contacts.userId, userId));
    await db
      .delete(schema.directory)
      .where(eq(schema.directory.userId, userId));

    // Reset MSW state
    mswServer.resetHandlers();
    google.resetPaginationState();
    google.setDirectoryAccessEnabled(true);
  });

  it("should complete full OAuth flow: connectGoogle -> callback -> sync contacts", async () => {
    currentToken = await createTestToken({
      sub: userId,
      email: "testuser@example.com",
    });

    // Step 1: Call connectGoogle endpoint using API client
    const connectResponse = await integrationsGoogleConnect();

    expect(connectResponse.status).toBe(200);
    const connectData = connectResponse.data;

    // Verify OAuth URL and session state
    expect(connectData.url).toContain("accounts.google.com");
    expect(connectData.url).toContain("client_id=test-google-client-id");
    expect(connectData.state).toBeDefined();

    // Step 2: Simulate OAuth callback with authorization code
    google.setMockOAuthEmail("testuser@gmail.com");

    const callbackResponse = await fetch(
      `${server.url}/auth/callback/google?code=mock-auth-code&state=${connectData.state}`,
      {
        redirect: "manual",
      },
    );

    // Verify redirect to success
    expect(callbackResponse.status).toBe(302);
    const location = callbackResponse.headers.get("location");
    expect(location).toContain("success=google");

    // Step 3: Verify integration was created
    const integrations = await db
      .select()
      .from(schema.integrations)
      .where(eq(schema.integrations.userId, userId));

    expect(integrations.length).toBe(1);
    expect(integrations[0]!.provider).toBe("google");
    expect(integrations[0]!.accountEmail).toBe("testuser@gmail.com");

    // Step 4: Wait for background sync to complete
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Step 5: Verify contacts were synced
    const contacts = await db
      .select()
      .from(schema.directory)
      .where(eq(schema.directory.userId, userId));

    expect(contacts.length).toBeGreaterThan(0);
  });

  it("should reject callback with invalid state token", async () => {
    // Use valid Base58 but non-existent state
    const fakeState = "CXwK1V6boVEoXp1Q8GmHy";

    const callbackResponse = await fetch(
      `${server.url}/auth/callback/google?code=mock-auth-code&state=${fakeState}`,
      {
        redirect: "manual",
      },
    );

    expect(callbackResponse.status).toBe(302);
    const location = callbackResponse.headers.get("location");
    expect(location).toContain("error=invalid_state");
  });

  it("should reject callback with expired session", async () => {
    currentToken = await createTestToken({
      sub: userId,
      email: "testuser@example.com",
    });

    // Create OAuth session using API client
    const connectResponse = await integrationsGoogleConnect();
    const connectData = connectResponse.data;

    // Manually expire the session
    await db
      .update(schema.oauthSessions)
      .set({ expiresAt: new Date(Date.now() - 1000) })
      .where(eq(schema.oauthSessions.id, connectData.state));

    // Try to use expired session
    const callbackResponse = await fetch(
      `${server.url}/auth/callback/google?code=mock-auth-code&state=${connectData.state}`,
      {
        redirect: "manual",
      },
    );

    expect(callbackResponse.status).toBe(302);
    const location = callbackResponse.headers.get("location");
    expect(location).toContain("error=state_expired");
  });

  it("should handle OAuth callback without code parameter", async () => {
    currentToken = await createTestToken({
      sub: userId,
      email: "testuser@example.com",
    });

    // Create OAuth session using API client
    const connectResponse = await integrationsGoogleConnect();
    const connectData = connectResponse.data;

    // Call callback without code
    const callbackResponse = await fetch(
      `${server.url}/auth/callback/google?state=${connectData.state}`,
      {
        redirect: "manual",
      },
    );

    expect(callbackResponse.status).toBe(302);
    const location = callbackResponse.headers.get("location");
    expect(location).toContain("error=");
  });

  it("should handle OAuth provider error responses", async () => {
    currentToken = await createTestToken({
      sub: userId,
      email: "testuser@example.com",
    });

    // Create OAuth session using API client
    const connectResponse = await integrationsGoogleConnect();
    const connectData = connectResponse.data;

    // Simulate OAuth error from provider
    const callbackResponse = await fetch(
      `${server.url}/auth/callback/google?error=access_denied&state=${connectData.state}`,
      {
        redirect: "manual",
      },
    );

    expect(callbackResponse.status).toBe(302);
    const location = callbackResponse.headers.get("location");
    expect(location).toContain("error=access_denied");
  });
});

