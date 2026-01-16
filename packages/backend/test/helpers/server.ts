import { startServer, type ServerInstance } from '../../src/server';
import { loadSettings } from '../../src/config';

export type TestServer = ServerInstance;

/**
 * Start test server on random port
 *
 * @param envOverrides - Environment variable overrides for testing
 * @returns Server instance
 */
export async function startTestServer(
  envOverrides: Record<string, string> = {}
): Promise<TestServer> {
  // Prepare test environment with defaults, then apply overrides
  // Note: SQLITE_DB_PATH must match the path used by createTestDatabase() in database.ts
  const defaults = {
    DB_PROVIDER: 'sqlite',
    SQLITE_DB_PATH: './test.db', // Must match TEST_DB_PATH in database.ts
    JWKS_URL: 'http://localhost:9999/.well-known/jwks.json',
    JWT_AUDIENCE: 'test-audience',
    JWT_ISSUER: 'http://localhost:9999/',
    DISABLE_JWT_VERIFICATION: 'true', // Always disable in tests by default
    PORT: '8787', // Default port for validation (actual port will be random via startServer)
    NODE_ENV: 'test',
  };

  // Merge defaults with overrides
  const env = { ...defaults, ...envOverrides };

  // Load settings with test environment
  loadSettings(env);

  // Start server with random port (0) - this overrides the PORT setting
  return startServer({ port: 0 });
}
