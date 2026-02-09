/**
 * MSW Server Lifecycle Management for Google API Mocking
 * Provides utilities to setup and manage MSW server in tests
 */

import { setupServer } from "msw/node";
import { googleHandlers } from "./handlers";

/**
 * Create and configure MSW server with Google API handlers
 *
 * Usage in tests:
 * ```typescript
 * const server = setupGoogleMockServer();
 * server.listen({ onUnhandledRequest: 'error' });
 * ```
 */
export function setupGoogleMockServer() {
  return setupServer(...googleHandlers);
}
