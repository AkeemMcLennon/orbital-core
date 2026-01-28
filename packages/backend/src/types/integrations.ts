import type { Integration, SecondaryChannel } from '../database/schema';

/**
 * OAuth2 token information
 */
export interface OAuth2Tokens {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: Date;
}

/**
 * Result of a sync operation
 */
export interface SyncResult {
  // Counts
  imported: number; // Total contacts imported
  matched: number; // Contacts matched to existing ones
  errors: number; // Failed contacts

  // Next token for delta-sync (if provided by provider)
  nextSyncToken?: string;

  // Error details
  errorDetails?: Array<{
    externalId?: string;
    error: string;
  }>;
}

/**
 * Contact information from external provider (before mapping to directory schema)
 */
export interface ExternalContact {
  externalId: string;
  displayName: string;
  email?: string;
  phone?: string;
  avatarUrl?: string;
  company?: string;
  emails?: Array<{ value: string; label?: string }>;
  phones?: Array<{ value: string; label?: string }>;
  socialProfiles?: Array<{ type: string; url: string }>;
  raw?: Record<string, any>;
}

/**
 * Decrypted integration record with credentials
 */
export interface DecryptedIntegration extends Integration {
  accessToken: string; // Decrypted
  refreshToken?: string; // Decrypted
}

export type { SecondaryChannel };
