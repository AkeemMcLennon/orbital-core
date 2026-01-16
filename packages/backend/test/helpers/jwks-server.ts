import { serve, type Server } from 'bun';
import { getPublicJWK } from './jwt';

let jwksServer: Server | null = null;
let jwksPort: number | null = null;

/**
 * Start mock JWKS server that serves public keys
 * Returns the actual port the server is running on
 */
export async function startJWKSServer(): Promise<number> {
  if (jwksServer) {
    console.log(`JWKS server already running on port ${jwksPort}, skipping...`);
    return jwksPort!;
  }

  const publicJWK = await getPublicJWK();

  jwksServer = serve({
    port: 0, // Let OS assign port
    fetch: async (req) => {
      const url = new URL(req.url);

      // JWKS endpoint
      if (url.pathname === '/.well-known/jwks.json') {
        return new Response(
          JSON.stringify({
            keys: [publicJWK],
          }),
          {
            headers: { 'Content-Type': 'application/json' },
          }
        );
      }

      // Health check
      if (url.pathname === '/health') {
        return new Response(JSON.stringify({ status: 'ok' }), {
          headers: { 'Content-Type': 'application/json' },
        });
      }

      return new Response('Not Found', { status: 404 });
    },
  });

  jwksPort = jwksServer.port;

  // Wait for server to be ready
  await waitForServer(`http://localhost:${jwksPort}/health`);

  return jwksPort;
}

/**
 * Stop mock JWKS server
 */
export async function stopJWKSServer(): Promise<void> {
  if (jwksServer) {
    jwksServer.stop();
    jwksServer = null;
  }
}

/**
 * Wait for server to be ready
 */
async function waitForServer(url: string, maxAttempts = 10): Promise<void> {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // Server not ready yet
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Server not ready at ${url} after ${maxAttempts} attempts`);
}
