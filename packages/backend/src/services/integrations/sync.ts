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

  console.log(
    `[sync] Starting sync integrationId=${integrationId} userId=${userId}`,
  );

  // 1. Fetch and decrypt integration record
  const integration = await getDecryptedIntegration(db, integrationId, userId);
  if (!integration) {
    throw new Error(`Integration not found: ${integrationId}`);
  }
  console.log(
    `[sync] Integration found source=${integration.source} lastSyncToken=${integration.lastSyncToken ? "set" : "none"}`,
  );

  // 2. Get the provider
  const provider = getProvider(integration.source);
  if (!provider) {
    throw new Error(`Provider not found for source: ${integration.source}`);
  }

  // 3. Refresh token if needed
  let accessToken = integration.accessToken;
  let refreshToken = integration.refreshToken ?? undefined;
  let expiresAt = integration.tokenExpiresAt ?? undefined;

  try {
    const refreshed = await provider.refreshTokenIfNeeded(
      accessToken,
      refreshToken,
      expiresAt,
    );
    if (refreshed.accessToken !== accessToken) {
      console.log(`[sync] Token refreshed`);
      accessToken = refreshed.accessToken;
      refreshToken = refreshed.refreshToken;
      expiresAt = refreshed.expiresAt;
      await updateIntegrationTokens(db, integrationId, userId, {
        accessToken,
        refreshToken,
        expiresAt,
      });
    } else {
      console.log(`[sync] Token still valid`);
    }
  } catch (error) {
    if (expiresAt && new Date() >= expiresAt) {
      throw error; // Token is definitely expired, fail the sync
    }
    console.log(
      `[sync] Token refresh failed (continuing with existing token): ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  // 4. Fetch and process contacts page-by-page as they arrive
  let nextSyncToken: string | undefined;
  let pageIndex = 0;

  for await (const page of provider.fetchContacts(
    accessToken,
    integration.lastSyncToken ?? undefined,
  )) {
    if (page.nextSyncToken) nextSyncToken = page.nextSyncToken;
    console.log(`[sync] Page ${pageIndex}: ${page.contacts.length} contacts`);
    if (page.contacts.length === 0) {
      pageIndex++;
      continue;
    }

    const rows = page.contacts.map((contactData) => ({
      ...contactData,
      userId,
    }));

    for (let batchStart = 0; batchStart < rows.length; batchStart += 10) {
      const batch = rows.slice(batchStart, batchStart + 10);
      try {
        await db
          .insert(directory)
          .values(batch)
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
            },
          });
        result.imported += batch.length;
        console.log(
          `[sync] Page ${pageIndex} batch ${batchStart / 10}: upserted ${batch.length} rows (total imported: ${result.imported})`,
        );
      } catch (error) {
        const cause = error instanceof Error ? error.cause : undefined;
        const msg = error instanceof Error ? error.message : String(error);
        console.error(
          `[sync] Page ${pageIndex} batch ${batchStart / 10}: DB error:`,
          msg,
          cause ?? error,
        );
        result.errors += batch.length;
        result.errorDetails?.push({
          error: msg,
        });
      }
    }

    pageIndex++;
  }

  // 5. Update integration sync state
  console.log(
    `[sync] Sync complete imported=${result.imported} errors=${result.errors}`,
  );
  await updateIntegrationSyncState(db, integrationId, userId, nextSyncToken);

  return result;
}
