import type { ServerInstance } from "@orbital/backend/src/server";

export type TestServer = ServerInstance;

export interface TestServerOptions {
  startServer: (config: any) => Promise<ServerInstance>;
  loadSettings: (env: Record<string, string>) => void;
  envOverrides?: Record<string, string>;
}

/**
 * Start test server on random port
 *
 * Backend dependencies (startServer, loadSettings) are injected
 */
export async function startTestServer(
  options: TestServerOptions,
): Promise<TestServer> {
  const { startServer, loadSettings, envOverrides = {} } = options;

  // Test environment defaults
  const defaults = {
    DB_PROVIDER: "sqlite",
    SQLITE_DB_PATH: "./test.db",
    JWKS_URL: "http://localhost:9999/.well-known/jwks.json",
    JWT_AUDIENCE: "test-audience",
    JWT_ISSUER: "http://localhost:9999/",
    DISABLE_JWT_VERIFICATION: "true",
    PORT: "8787",
    NODE_ENV: "test",
    DB_ENCRYPTION_KEY: "0sv02gmzhamuqCx36UDVUboTqNfMSO3jSMpTFhhCvnE",
  };

  // Merge defaults with overrides
  const env = { ...defaults, ...envOverrides };

  // Load settings with test environment (injected function)
  loadSettings(env);

  // Start server with random port (injected function)
  return startServer({ port: 0 });
}
