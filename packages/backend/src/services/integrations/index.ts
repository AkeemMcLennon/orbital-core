/**
 * Integrations service public API
 * Exports all public functions and types for managing external integrations
 */

export { syncIntegration } from "./sync";
export {
  storeIntegrationCredentials,
  getDecryptedIntegration,
  updateIntegrationTokens,
  updateIntegrationSyncState,
  getUserIntegrations,
  getUserIntegrationsBySource,
  deleteIntegration,
} from "./credentials";
export {
  type DirectoryProvider,
  type FetchContactsPage,
  registerProvider,
  getProvider,
  listProviders,
} from "./provider";

// Register built-in providers
import { registerProvider } from "./provider";
import { googleProvider } from "./google";

registerProvider(googleProvider);
