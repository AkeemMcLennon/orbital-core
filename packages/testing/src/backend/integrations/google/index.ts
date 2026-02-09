/**
 * Google People API Testing Utilities
 * Public exports for Google integration testing
 */

// MSW Server setup
export { setupGoogleMockServer } from "./server";

// Mock data fixtures and utilities
export {
  createGooglePerson,
  createPersonalContactsFixture,
  createDirectoryContactsFixture,
  resetPaginationState,
  generatePersonalContactsResponse,
  generateDirectoryContactsResponse,
  setDirectoryAccessEnabled,
  shouldDenyDirectoryAccess,
} from "./fixtures";

// Type definitions
export type {
  GooglePeopleApiResponse,
  GoogleDirectoryResponse,
  GooglePerson,
  GoogleName,
  GoogleEmailAddress,
  GooglePhoneNumber,
  GooglePhoto,
  GoogleOrganization,
  GoogleUrl,
} from "./fixtures";

// MSW handlers (for advanced usage)
export {
  googleHandlers,
  oauthTokenHandler,
  personalContactsHandler,
  directoryContactsHandler,
  setMockOAuthEmail,
} from "./handlers";
