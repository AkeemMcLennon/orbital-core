import { eq, and } from 'drizzle-orm';
import { integrations } from '../../database/schema';
import { crypto } from '../../utils/crypto';
import type { DatabaseClient } from '../../database/client';
import type { Integration, NewIntegration } from '../../database/schema';
import type { DecryptedIntegration, OAuth2Tokens } from '../../types/integrations';

/**
 * Store encrypted OAuth credentials for an integration
 */
export async function storeIntegrationCredentials(
  db: DatabaseClient,
  userId: string,
  source: string,
  accountId: string,
  tokens: OAuth2Tokens,
): Promise<Integration> {
  // Encrypt tokens with userId as AAD context to prevent token substitution attacks
  const encryptedAccessToken = crypto.encrypt(tokens.accessToken, userId);
  const encryptedRefreshToken = tokens.refreshToken
    ? crypto.encrypt(tokens.refreshToken, userId)
    : null;

  const [integration] = await db
    .insert(integrations)
    .values({
      userId,
      source,
      accountId,
      accessToken: encryptedAccessToken,
      refreshToken: encryptedRefreshToken || undefined,
      tokenExpiresAt: tokens.expiresAt,
    })
    .onConflictDoUpdate({
      target: [integrations.userId, integrations.source, integrations.accountId],
      set: {
        accessToken: encryptedAccessToken,
        refreshToken: encryptedRefreshToken || undefined,
        tokenExpiresAt: tokens.expiresAt,
        updatedAt: new Date(),
      },
    })
    .returning();

  return integration;
}

/**
 * Retrieve and decrypt integration credentials
 */
export async function getDecryptedIntegration(
  db: DatabaseClient,
  integrationId: string,
  userId: string,
): Promise<DecryptedIntegration | null> {
  const [integration] = await db
    .select()
    .from(integrations)
    .where(and(eq(integrations.id, integrationId), eq(integrations.userId, userId)));

  if (!integration) {
    return null;
  }

  // Decrypt tokens with userId as AAD context for verification
  const decrypted: DecryptedIntegration = {
    ...integration,
    accessToken: crypto.decrypt(integration.accessToken, userId),
    refreshToken: integration.refreshToken
      ? crypto.decrypt(integration.refreshToken, userId)
      : undefined,
  };

  return decrypted;
}

/**
 * Update integration after token refresh
 */
export async function updateIntegrationTokens(
  db: DatabaseClient,
  integrationId: string,
  userId: string,
  tokens: OAuth2Tokens,
): Promise<Integration> {
  const encryptedAccessToken = crypto.encrypt(tokens.accessToken, userId);
  const encryptedRefreshToken = tokens.refreshToken
    ? crypto.encrypt(tokens.refreshToken, userId)
    : null;

  const [updated] = await db
    .update(integrations)
    .set({
      accessToken: encryptedAccessToken,
      refreshToken: encryptedRefreshToken || undefined,
      tokenExpiresAt: tokens.expiresAt,
      updatedAt: new Date(),
    })
    .where(and(eq(integrations.id, integrationId), eq(integrations.userId, userId)))
    .returning();

  return updated;
}

/**
 * Update sync metadata after successful sync
 */
export async function updateIntegrationSyncState(
  db: DatabaseClient,
  integrationId: string,
  userId: string,
  lastSyncToken?: string,
): Promise<Integration> {
  const [updated] = await db
    .update(integrations)
    .set({
      lastSyncToken,
      lastSyncAt: new Date(),
      updatedAt: new Date(),
    })
    .where(and(eq(integrations.id, integrationId), eq(integrations.userId, userId)))
    .returning();

  return updated;
}

/**
 * Get all integrations for a user
 */
export async function getUserIntegrations(
  db: DatabaseClient,
  userId: string,
): Promise<Integration[]> {
  return db.select().from(integrations).where(eq(integrations.userId, userId));
}

/**
 * Get integrations by source for a user
 */
export async function getUserIntegrationsBySource(
  db: DatabaseClient,
  userId: string,
  source: string,
): Promise<Integration[]> {
  return db
    .select()
    .from(integrations)
    .where(and(eq(integrations.userId, userId), eq(integrations.source, source)));
}

/**
 * Delete an integration
 */
export async function deleteIntegration(
  db: DatabaseClient,
  integrationId: string,
  userId: string,
): Promise<boolean> {
  const result = await db
    .delete(integrations)
    .where(and(eq(integrations.id, integrationId), eq(integrations.userId, userId)));

  return result.changes > 0;
}
