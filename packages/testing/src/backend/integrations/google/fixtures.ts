/**
 * Google People API Mock Data Fixtures
 * Provides generic, deterministic test data for Google integration tests
 */

/**
 * Google People API type definitions (matching google.ts)
 */
export interface GooglePeopleApiResponse {
  connections?: GooglePerson[];
  nextPageToken?: string;
  nextSyncToken?: string;
}

export interface GoogleDirectoryResponse {
  people?: GooglePerson[];
  nextPageToken?: string;
}

export interface GooglePerson {
  resourceName: string;
  names?: GoogleName[];
  emailAddresses?: GoogleEmailAddress[];
  phoneNumbers?: GooglePhoneNumber[];
  photos?: GooglePhoto[];
  organizations?: GoogleOrganization[];
  urls?: GoogleUrl[];
  birthdays?: GoogleBirthday[];
}

export interface GoogleName {
  displayName?: string;
  familyName?: string;
  givenName?: string;
  metadata?: { primary?: boolean };
}

export interface GoogleEmailAddress {
  value?: string;
  type?: string;
  displayName?: string;
  metadata?: { primary?: boolean };
}

export interface GooglePhoneNumber {
  value?: string;
  type?: string;
  displayName?: string;
  metadata?: { primary?: boolean };
}

export interface GooglePhoto {
  url?: string;
  metadata?: { primary?: boolean };
}

export interface GoogleOrganization {
  name?: string;
  title?: string;
  metadata?: { primary?: boolean };
}

export interface GoogleUrl {
  type?: string;
  value?: string;
  displayName?: string;
}

export interface GoogleBirthday {
  date?: {
    year?: number;
    month?: number;
    day?: number;
  };
  metadata?: { primary?: boolean };
}

/**
 * Configuration state
 */
interface PaginationState {
  personalContacts: GooglePerson[];
  directoryContacts: GooglePerson[];
  pageSize: number;
}

let paginationState: PaginationState = {
  personalContacts: [],
  directoryContacts: [],
  pageSize: 3,
};

let directoryAccessEnabled = true;

/**
 * Create a single Google Person with generic test data
 */
export function createGooglePerson(
  options: Partial<GooglePerson> & { id: string; source?: "personal" | "directory" }
): GooglePerson {
  const { id, source = "personal", ...overrides } = options;
  const resourceName =
    source === "directory"
      ? `people/directory/${id}`
      : `people/${id}`;

  return {
    resourceName,
    names: overrides.names || [
      {
        displayName: `Test User ${id}`,
        givenName: "Test",
        familyName: `User${id}`,
        metadata: { primary: true },
      },
    ],
    emailAddresses: overrides.emailAddresses || [
      {
        value: `user${id}@example.com`,
        type: "work",
        metadata: { primary: true },
      },
    ],
    phoneNumbers: overrides.phoneNumbers || [
      {
        value: `+1-555-${id.padStart(4, "0")}`,
        type: "mobile",
        metadata: { primary: true },
      },
    ],
    photos: overrides.photos || [
      {
        url: `https://example.com/photos/${id}.jpg`,
        metadata: { primary: true },
      },
    ],
    organizations: overrides.organizations,
    urls: overrides.urls,
    birthdays: overrides.birthdays,
  };
}

/**
 * Create a fixture of personal contacts with various data scenarios
 */
export function createPersonalContactsFixture(count: number = 10): GooglePerson[] {
  const contacts: GooglePerson[] = [];

  if (count >= 1) {
    // Contact 1: Full data with organization, social, and birthday with year
    contacts.push(
      createGooglePerson({
        id: "001",
        organizations: [
          { name: "Acme Corp", title: "Software Engineer", metadata: { primary: true } },
        ],
        urls: [{ type: "linkedin", value: "https://linkedin.com/in/user001" }],
        birthdays: [
          { date: { year: 1990, month: 3, day: 15 }, metadata: { primary: true } },
        ],
      })
    );
  }

  if (count >= 2) {
    // Contact 2: Minimal data (no phone, no photo) with birthday without year
    contacts.push(
      createGooglePerson({
        id: "002",
        phoneNumbers: undefined,
        photos: undefined,
        birthdays: [
          { date: { year: 0, month: 7, day: 4 }, metadata: { primary: true } },
        ],
      })
    );
  }

  if (count >= 3) {
    // Contact 3: Multiple channels (secondary emails, phones, social)
    contacts.push(
      createGooglePerson({
        id: "003",
        emailAddresses: [
          { value: "user003@work.com", type: "work", metadata: { primary: true } },
          { value: "user003@personal.com", type: "home" },
        ],
        phoneNumbers: [
          { value: "+1-555-0003", type: "mobile", metadata: { primary: true } },
          { value: "+1-555-0004", type: "work" },
        ],
        urls: [
          { type: "twitter", value: "https://twitter.com/user003" },
          { type: "linkedin", value: "https://linkedin.com/in/user003" },
        ],
      })
    );
  }

  // Generate remaining contacts with simple data
  for (let i = contacts.length; i < count; i++) {
    const id = String(i + 1).padStart(3, "0");
    contacts.push(createGooglePerson({ id }));
  }

  return contacts;
}

/**
 * Create a fixture of directory contacts
 */
export function createDirectoryContactsFixture(count: number = 5): GooglePerson[] {
  const contacts: GooglePerson[] = [];

  for (let i = 0; i < count; i++) {
    const id = String(i + 1).padStart(3, "0");
    contacts.push(
      createGooglePerson({
        id: `dir${id}`,
        source: "directory",
        organizations: [
          { name: "Workspace Company", title: "Team Member", metadata: { primary: true } },
        ],
      })
    );
  }

  return contacts;
}

/**
 * Reset pagination state to initial values
 */
export function resetPaginationState(options?: {
  personalCount?: number;
  directoryCount?: number;
  pageSize?: number;
}) {
  paginationState = {
    personalContacts: createPersonalContactsFixture(options?.personalCount || 10),
    directoryContacts: createDirectoryContactsFixture(options?.directoryCount || 5),
    pageSize: options?.pageSize || 3,
  };
}

/**
 * Generate a personal contacts API response with pagination
 */
export function generatePersonalContactsResponse(options: {
  pageToken?: string | null;
  syncToken?: string | null;
  pageSize?: number;
}): GooglePeopleApiResponse {
  const { pageToken, syncToken, pageSize = paginationState.pageSize } = options;

  // Handle sync token (delta sync - return one changed contact)
  if (syncToken) {
    return {
      connections: paginationState.personalContacts.length > 0
        ? [paginationState.personalContacts[0]]
        : [],
      nextSyncToken: `sync_${Date.now()}`,
    };
  }

  // Handle pagination
  const pageNum = pageToken ? parseInt(pageToken.replace("page", ""), 10) : 1;
  const startIdx = (pageNum - 1) * pageSize;
  const endIdx = startIdx + pageSize;

  const pageContacts = paginationState.personalContacts.slice(startIdx, endIdx);
  const hasMore = endIdx < paginationState.personalContacts.length;

  return {
    connections: pageContacts,
    nextPageToken: hasMore ? `page${pageNum + 1}` : undefined,
    nextSyncToken: !hasMore ? `sync_${Date.now()}` : undefined,
  };
}

/**
 * Generate a directory contacts API response with pagination
 */
export function generateDirectoryContactsResponse(options: {
  pageToken?: string | null;
  pageSize?: number;
}): GoogleDirectoryResponse {
  const { pageToken, pageSize = paginationState.pageSize } = options;

  // Handle pagination
  const pageNum = pageToken ? parseInt(pageToken.replace("page", ""), 10) : 1;
  const startIdx = (pageNum - 1) * pageSize;
  const endIdx = startIdx + pageSize;

  const pageContacts = paginationState.directoryContacts.slice(startIdx, endIdx);
  const hasMore = endIdx < paginationState.directoryContacts.length;

  return {
    people: pageContacts,
    nextPageToken: hasMore ? `page${pageNum + 1}` : undefined,
  };
}

/**
 * Configure whether directory access should be enabled
 */
export function setDirectoryAccessEnabled(enabled: boolean) {
  directoryAccessEnabled = enabled;
}

/**
 * Check if directory access should be denied (403/404)
 */
export function shouldDenyDirectoryAccess(): boolean {
  return !directoryAccessEnabled;
}

// Initialize with default data
resetPaginationState();
