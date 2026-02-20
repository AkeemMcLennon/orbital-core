import { sql } from "drizzle-orm";
import { directory } from "../../database/schema";
import {
  getDecryptedIntegration,
  updateIntegrationTokens,
  updateIntegrationSyncState,
} from "./credentials";
import { getProvider } from "./provider";
import type { DatabaseClient } from "../../database/client";
import type { SyncResult } from "../../types/integrations";
import type { DirectoryProvider } from "./provider";

/**
 * Sync contacts from an external integration
 * Handles token refresh, fetching, matching, and upsert
 */
export async function syncIntegration(
  db: DatabaseClient,
  integrationId: string,
  userId: string,
): Promise<SyncResult> {
  const result: SyncResult = {
    imported: 0,
    matched: 0,
    errors: 0,
    errorDetails: [],
  };

  try {
    console.log("Starting sync");
    // 1. Fetch and decrypt integration record
    const integration = await getDecryptedIntegration(
      db,
      integrationId,
      userId,
    );
    if (!integration) {
      throw new Error(`Integration not found: ${integrationId}`);
    }

    // 2. Get the provider
    const provider = getProvider(integration.source);
    if (!provider) {
      throw new Error(`Provider not found for source: ${integration.source}`);
    }

    // 3. Refresh token if needed
    let accessToken = integration.accessToken;
    let refreshToken = integration.refreshToken;
    let expiresAt = integration.tokenExpiresAt;

    try {
      const refreshed = await provider.refreshTokenIfNeeded(
        accessToken,
        refreshToken,
        expiresAt,
      );
      accessToken = refreshed.accessToken;
      refreshToken = refreshed.refreshToken;
      expiresAt = refreshed.expiresAt;

      // If token was refreshed, update database
      if (accessToken !== integration.accessToken) {
        await updateIntegrationTokens(db, integrationId, userId, {
          accessToken,
          refreshToken,
          expiresAt,
        });
      }
    } catch (error) {
      // Token refresh failed but continue with existing token if not expired
      if (expiresAt && new Date() >= expiresAt) {
        throw error; // Token is definitely expired, fail the sync
      }
      // Otherwise continue with existing token
    }

    // 4. Fetch and process contacts page-by-page as they arrive
    let nextSyncToken: string | undefined;

    for await (const page of provider.fetchContacts(
      accessToken,
      integration.lastSyncToken,
    )) {
      if (page.nextSyncToken) nextSyncToken = page.nextSyncToken;
      if (page.contacts.length === 0) continue;

      const rows = page.contacts.map((contactData) => ({
        ...contactData,
        userId,
      }));

      try {
        await db.transaction(async (tx) => {
          await tx
            .insert(directory)
            .values(rows)
            .onConflictDoUpdate({
              target: [directory.userId, directory.source, directory.externalId!],
              set: {
                email: sql`excluded.email`,
                phone: sql`excluded.phone`,
                name: sql`excluded.name`,
                avatarUrl: sql`excluded.avatar_url`,
                company: sql`excluded.company`,
                birthday: sql`excluded.birthday`,
                secondaryData: sql`excluded.secondary_data`,
                rawMetadata: sql`excluded.raw_metadata`,
              },
            });
        });
        result.imported += rows.length;
      } catch (error) {
        result.errors += rows.length;
        result.errorDetails?.push({
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    // 5. Update integration sync state
    await updateIntegrationSyncState(db, integrationId, userId, nextSyncToken);
  } catch (error) {
    result.errors++;
    result.errorDetails?.push({
      error: error instanceof Error ? error.message : String(error),
    });
  }

  return result;
}

