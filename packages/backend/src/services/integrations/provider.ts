import type { NewDirectoryEntry } from '../../database/schema';
import type { ExternalContact, SyncResult } from '../../types/integrations';

/**
 * Result from fetching contacts from a provider
 */
export interface FetchContactsResult {
  // Contacts mapped to directory entry format
  contacts: NewDirectoryEntry[];

  // Provider-specific sync token for delta-syncs (optional)
  nextSyncToken?: string;
}

/**
 * Base interface for directory providers
 * All external contact sources must implement this interface
 */
export interface DirectoryProvider {
  // Metadata
  readonly sourceId: string; // 'google', 'csv', 'linkedin', etc.
  readonly name: string; // Display name for UI

  /**
   * Refresh access token if needed
   * Called before each sync to ensure token validity
   *
   * @param accessToken - Current access token
   * @param refreshToken - Refresh token (if applicable)
   * @param tokenExpiresAt - Token expiration time
   * @returns New access token (or original if no refresh needed)
   */
  refreshTokenIfNeeded(
    accessToken: string,
    refreshToken?: string,
    tokenExpiresAt?: Date,
  ): Promise<{ accessToken: string; refreshToken?: string; expiresAt?: Date }>;

  /**
   * Fetch contacts from the external source
   * Implements delta-sync using syncToken if provided
   *
   * @param accessToken - Valid access token
   * @param syncToken - Previous sync token for delta-sync (optional)
   * @returns Fetched contacts and next sync token
   */
  fetchContacts(accessToken: string, syncToken?: string): Promise<FetchContactsResult>;
}

/**
 * Factory for creating provider instances
 */
export interface ProviderFactory {
  create(sourceId: string): DirectoryProvider | null;
}

/**
 * Registry of available providers
 */
export const providerRegistry = new Map<string, DirectoryProvider>();

/**
 * Register a provider
 */
export function registerProvider(provider: DirectoryProvider): void {
  providerRegistry.set(provider.sourceId, provider);
}

/**
 * Get a provider by source ID
 */
export function getProvider(sourceId: string): DirectoryProvider | null {
  return providerRegistry.get(sourceId) ?? null;
}

/**
 * List all registered providers
 */
export function listProviders(): DirectoryProvider[] {
  return Array.from(providerRegistry.values());
}
