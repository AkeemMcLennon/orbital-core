import { google, type people_v1 } from "googleapis";
import type { DirectoryProvider, FetchContactsResult } from "./provider";
import type {
  NewDirectoryEntry,
  SecondaryChannel,
} from "../../database/schema";

/**
 * Google People API provider
 * Implements directory provider for Google Contacts using the official googleapis client
 */
class GoogleProvider implements DirectoryProvider {
  readonly sourceId = "google";
  readonly name = "Google Contacts";

  /**
   * Create a People API client with the given access token
   * Uses native fetch for compatibility with MSW in tests
   */
  private createPeopleClient(accessToken: string): people_v1.People {
    const auth = new google.auth.OAuth2();
    auth.setCredentials({ access_token: accessToken });

    return google.people({
      version: "v1",
      auth,
      // Use native fetch for MSW compatibility in tests
      fetchImplementation: fetch,
    });
  }

  /**
   * Refresh access token if needed (OAuth2 flow)
   * Note: This requires a refresh token and Google OAuth credentials
   * For now, this is a placeholder - full OAuth implementation in Phase 1b
   */
  async refreshTokenIfNeeded(
    accessToken: string,
    refreshToken?: string,
    tokenExpiresAt?: Date,
  ): Promise<{ accessToken: string; refreshToken?: string; expiresAt?: Date }> {
    // Check if token is expired
    if (tokenExpiresAt && new Date() < tokenExpiresAt) {
      // Token still valid
      return { accessToken, refreshToken, expiresAt: tokenExpiresAt };
    }

    // Token expired and no refresh token - cannot refresh
    if (!refreshToken) {
      throw new Error(
        "Google access token expired and no refresh token available. Re-authentication required.",
      );
    }

    // TODO: Implement actual token refresh with Google OAuth
    // This will be done in Phase 1b when OAuth endpoints are added
    throw new Error(
      "Token refresh not yet implemented. See Phase 1b OAuth implementation.",
    );
  }

  /**
   * Fetch contacts from Google People API
   * Combines personal connections and company directory
   */
  async fetchContacts(
    accessToken: string,
    syncToken?: string,
  ): Promise<FetchContactsResult> {
    const [personalResult, directoryContacts] = await Promise.all([
      this.fetchPersonalContacts(accessToken, syncToken),
      this.fetchDirectoryContacts(accessToken),
    ]);

    return {
      contacts: [...personalResult.contacts, ...directoryContacts],
      nextSyncToken: personalResult.nextSyncToken,
    };
  }

  /**
   * Fetch personal connections from Google using googleapis
   */
  private async fetchPersonalContacts(
    accessToken: string,
    syncToken?: string,
  ): Promise<FetchContactsResult> {
    const contacts: NewDirectoryEntry[] = [];
    let nextSyncToken: string | undefined;
    let nextPageToken: string | undefined;

    const people = this.createPeopleClient(accessToken);

    try {
      do {
        const response = await people.people.connections.list({
          resourceName: "people/me",
          pageSize: 100,
          personFields:
            "names,emailAddresses,phoneNumbers,photos,organizations,urls",
          requestSyncToken: true,
          syncToken: syncToken,
          pageToken: nextPageToken,
        });

        const data = response.data;

        // Process contacts
        if (data.connections && data.connections.length > 0) {
          for (const person of data.connections) {
            const contact = this.mapGooglePersonToDirectory(person);
            if (contact) {
              contacts.push(contact);
            }
          }
        }

        // Handle pagination
        nextPageToken = data.nextPageToken ?? undefined;
        nextSyncToken = data.nextSyncToken ?? undefined;
      } while (nextPageToken);
    } catch (error) {
      throw new Error(
        `Failed to fetch personal contacts from Google: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    return {
      contacts,
      nextSyncToken,
    };
  }

  /**
   * Fetch company directory people from Google Workspace using googleapis
   */
  private async fetchDirectoryContacts(
    accessToken: string,
  ): Promise<NewDirectoryEntry[]> {
    const contacts: NewDirectoryEntry[] = [];
    let nextPageToken: string | undefined;

    console.log(`Fetching access token ${accessToken}`);

    const people = this.createPeopleClient(accessToken);

    try {
      do {
        const response = await people.people.listDirectoryPeople({
          readMask: "names,emailAddresses,phoneNumbers,photos",
          sources: ["DIRECTORY_SOURCE_TYPE_DOMAIN_CONTACT"],
          pageSize: 100,
          pageToken: nextPageToken,
        });

        const data = response.data;

        if (data.people && data.people.length > 0) {
          for (const person of data.people) {
            const contact = this.mapGooglePersonToDirectory(person);
            if (contact) {
              contacts.push(contact);
            }
          }
        }

        nextPageToken = data.nextPageToken ?? undefined;
      } while (nextPageToken);
    } catch (error: any) {
      console.error("Failed to fetch directory contacts from Google:", error);
      // 403 or 404 might mean directory access is not available for this account
      if (error?.code === 403 || error?.code === 404) {
        console.warn(
          "Google Directory API access denied or unavailable. Skipping directory sync.",
        );
        return [];
      }
      // Don't fail the whole sync if directory fails, just return what we have
      return [];
    }

    return contacts;
  }

  /**
   * Map Google Person object to Orbital directory entry
   */
  private mapGooglePersonToDirectory(
    person: people_v1.Schema$Person,
  ): NewDirectoryEntry | null {
    // Use the full resourceName as externalId to ensure uniqueness across sources
    const externalId = person.resourceName;

    if (!externalId) {
      return null; // Skip contacts without resource name
    }

    // Get primary name
    const displayName = this.getPrimaryName(person.names);
    if (!displayName) {
      return null; // Skip contacts without names
    }

    // Get primary email and phone
    const primaryEmail = this.getPrimaryEmail(person.emailAddresses);
    const primaryPhone = this.getPrimaryPhoneNumber(person.phoneNumbers);

    // Get avatar URL
    const avatarUrl = this.getPrimaryPhotoUrl(person.photos);

    // Get company
    const company = this.getPrimaryOrganization(person.organizations);

    // Collect secondary channels (overflow emails, phones, social)
    const secondaryData = this.buildSecondaryData(
      person.emailAddresses,
      person.phoneNumbers,
      person.urls,
    );

    return {
      source: "google",
      externalId,
      name: displayName,
      email: primaryEmail,
      phone: primaryPhone,
      avatarUrl,
      company,
      secondaryData: secondaryData.length > 0 ? secondaryData : undefined,
      rawMetadata: person,
    };
  }

  /**
   * Build secondary data array from all contact methods
   */
  private buildSecondaryData(
    emails?: people_v1.Schema$EmailAddress[],
    phones?: people_v1.Schema$PhoneNumber[],
    urls?: people_v1.Schema$Url[],
  ): SecondaryChannel[] {
    const channels: SecondaryChannel[] = [];

    // Add secondary emails (skip first, which is already primary)
    if (emails && emails.length > 1) {
      for (let i = 1; i < emails.length; i++) {
        const email = emails[i];
        if (email.value) {
          channels.push({
            type: "email",
            value: email.value,
            label: email.displayName || email.type || undefined,
          });
        }
      }
    }

    // Add secondary phone numbers (skip first, which is already primary)
    if (phones && phones.length > 1) {
      for (let i = 1; i < phones.length; i++) {
        const phone = phones[i];
        if (phone.value) {
          channels.push({
            type: "phone",
            value: phone.value,
            label: phone.formattedType || phone.type || undefined,
          });
        }
      }
    }

    // Add social profiles from URLs
    if (urls) {
      for (const url of urls) {
        if (url.value) {
          // Map social network type to our enum
          const type = this.mapSocialNetworkType(url.type || "OTHER");
          if (type) {
            channels.push({
              type,
              value: url.value,
              label: url.formattedType || undefined,
            });
          }
        }
      }
    }

    return channels;
  }

  /**
   * Get primary name from names array
   */
  private getPrimaryName(names?: people_v1.Schema$Name[]): string | null {
    if (!names || names.length === 0) {
      return null;
    }

    // Find primary or first name with displayName
    for (const name of names) {
      if (name.metadata?.primary && name.displayName) {
        return name.displayName;
      }
    }

    // Fall back to first name with displayName
    return names[0]?.displayName || null;
  }

  /**
   * Get primary email address
   */
  private getPrimaryEmail(
    emails?: people_v1.Schema$EmailAddress[],
  ): string | undefined {
    if (!emails || emails.length === 0) {
      return undefined;
    }

    // Find primary or first email
    for (const email of emails) {
      if (email.metadata?.primary) {
        return email.value ?? undefined;
      }
    }

    return emails[0]?.value ?? undefined;
  }

  /**
   * Get primary phone number
   */
  private getPrimaryPhoneNumber(
    phones?: people_v1.Schema$PhoneNumber[],
  ): string | undefined {
    if (!phones || phones.length === 0) {
      return undefined;
    }

    // Find primary or first phone
    for (const phone of phones) {
      if (phone.metadata?.primary) {
        return phone.value ?? undefined;
      }
    }

    return phones[0]?.value ?? undefined;
  }

  /**
   * Get primary photo/avatar URL
   */
  private getPrimaryPhotoUrl(
    photos?: people_v1.Schema$Photo[],
  ): string | undefined {
    if (!photos || photos.length === 0) {
      return undefined;
    }

    // Find primary or first photo
    for (const photo of photos) {
      if (photo.metadata?.primary && photo.url) {
        return photo.url;
      }
    }

    return photos[0]?.url ?? undefined;
  }

  /**
   * Get primary organization/company
   */
  private getPrimaryOrganization(
    organizations?: people_v1.Schema$Organization[],
  ): string | undefined {
    if (!organizations || organizations.length === 0) {
      return undefined;
    }

    // Find primary or first organization
    for (const org of organizations) {
      if (org.metadata?.primary && org.name) {
        return org.name;
      }
    }

    return organizations[0]?.name ?? undefined;
  }

  /**
   * Map Google social network types to our SecondaryChannel types
   */
  private mapSocialNetworkType(
    googleType: string,
  ): "linkedin" | "twitter" | "other" | null {
    switch (googleType?.toLowerCase()) {
      case "linkedin":
        return "linkedin";
      case "twitter":
        return "twitter";
      case "facebook":
      case "instagram":
      case "github":
        return "other";
      default:
        return null;
    }
  }
}

// Export singleton instance
export const googleProvider = new GoogleProvider();
