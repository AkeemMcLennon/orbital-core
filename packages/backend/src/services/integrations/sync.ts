import { eq, and, or } from 'drizzle-orm';
import { directory, contacts, contactChannels } from '../../database/schema';
import {
  getDecryptedIntegration,
  updateIntegrationTokens,
  updateIntegrationSyncState,
} from './credentials';
import { getProvider } from './provider';
import type { DatabaseClient } from '../../database/client';
import type { SyncResult } from '../../types/integrations';
import type { DirectoryProvider } from './provider';
import type { Contact } from '../../database/schema';

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
    // 1. Fetch and decrypt integration record
    const integration = await getDecryptedIntegration(db, integrationId, userId);
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

    // 4. Fetch contacts from provider
    const fetchResult = await provider.fetchContacts(accessToken, integration.lastSyncToken);

    // 5. Process and upsert contacts
    for (const contactData of fetchResult.contacts) {
      try {
        // Find existing contact (exact matching)
        const existingContact = await findExistingContact(db, userId, contactData.email, contactData.phone);

        // Prepare upsert data
        const upsertData = {
          ...contactData,
          userId, // Ensure user ID is set
          activeContactId: existingContact?.id, // Link to existing contact if found
        };

        // Upsert into directory
        await db
          .insert(directory)
          .values(upsertData)
          .onConflictDoUpdate({
            target: [directory.userId, directory.source, directory.externalId!],
            set: {
              email: upsertData.email,
              phone: upsertData.phone,
              name: upsertData.name,
              avatarUrl: upsertData.avatarUrl,
              company: upsertData.company,
              birthday: upsertData.birthday,
              secondaryData: upsertData.secondaryData,
              rawMetadata: upsertData.rawMetadata,
              activeContactId: upsertData.activeContactId,
              // Note: createdAt is preserved by Drizzle
            },
          });

        result.imported++;
        if (existingContact) {
          result.matched++;
        }
      } catch (error) {
        result.errors++;
        result.errorDetails?.push({
          externalId: contactData.externalId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    // 6. Update integration sync state
    await updateIntegrationSyncState(db, integrationId, userId, fetchResult.nextSyncToken);
  } catch (error) {
    result.errors++;
    result.errorDetails?.push({
      error: error instanceof Error ? error.message : String(error),
    });
  }

  return result;
}

/**
 * Find an existing contact by email or phone (exact matching)
 * Searches both primary fields and overflow channels
 */
async function findExistingContact(
  db: DatabaseClient,
  userId: string,
  email?: string,
  phone?: string,
): Promise<Contact | null> {
  if (!email && !phone) {
    return null; // Can't match without email or phone
  }

  const conditions = [];

  // Search by email: primary or in contact_channels
  if (email) {
    const normalizedEmail = normalizeEmail(email);
    conditions.push(
      or(
        // Primary email field
        and(
          eq(contacts.userId, userId),
          eq(contacts.email, normalizedEmail),
        ),
      ),
    );
  }

  // Search by phone: primary or in contact_channels
  if (phone && !conditions.length) {
    const normalizedPhone = normalizePhone(phone);
    conditions.push(
      or(
        // Primary phone field
        and(
          eq(contacts.userId, userId),
          eq(contacts.phone, normalizedPhone),
        ),
      ),
    );
  }

  if (!conditions.length) {
    return null;
  }

  // Try email first
  if (email) {
    const normalizedEmail = normalizeEmail(email);
    const [found] = await db
      .select()
      .from(contacts)
      .where(and(eq(contacts.userId, userId), eq(contacts.email, normalizedEmail)))
      .limit(1);

    if (found) {
      return found;
    }

    // Try contact_channels for email
    const [channelMatch] = await db
      .select({ contact: contacts })
      .from(contactChannels)
      .innerJoin(contacts, eq(contactChannels.contactId, contacts.id))
      .where(
        and(
          eq(contacts.userId, userId),
          eq(contactChannels.type, 'email'),
          eq(contactChannels.value, normalizedEmail),
        ),
      )
      .limit(1);

    if (channelMatch?.contact) {
      return channelMatch.contact;
    }
  }

  // Try phone
  if (phone) {
    const normalizedPhone = normalizePhone(phone);
    const [found] = await db
      .select()
      .from(contacts)
      .where(and(eq(contacts.userId, userId), eq(contacts.phone, normalizedPhone)))
      .limit(1);

    if (found) {
      return found;
    }

    // Try contact_channels for phone
    const [channelMatch] = await db
      .select({ contact: contacts })
      .from(contactChannels)
      .innerJoin(contacts, eq(contactChannels.contactId, contacts.id))
      .where(
        and(
          eq(contacts.userId, userId),
          eq(contactChannels.type, 'phone'),
          eq(contactChannels.value, normalizedPhone),
        ),
      )
      .limit(1);

    if (channelMatch?.contact) {
      return channelMatch.contact;
    }
  }

  return null;
}

/**
 * Normalize email for comparison (lowercase, trim)
 */
function normalizeEmail(email: string): string {
  return email.toLowerCase().trim();
}

/**
 * Normalize phone for comparison
 * Removes non-digit characters for consistent matching
 */
function normalizePhone(phone: string): string {
  // Remove all non-digit characters
  return phone.replace(/\D/g, '');
}
