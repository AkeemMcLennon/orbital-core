import type { Server } from 'bun';
import app from './app';

export interface ServerInstance {
  server: Server<unknown>;
  port: number;
  url: string;
  stop: () => void;
}

export interface ServerOptions {
  port?: number;
  hostname?: string;
}

/**
 * Start HTTP server
 *
 * @param options - Server configuration options
 * @param options.port - Port to listen on (0 for random port, default: 8787)
 * @param options.hostname - Hostname to bind to (default: 'localhost')
 * @returns Server instance with metadata and stop function
 */
export async function startServer(
  options: ServerOptions = {}
): Promise<ServerInstance> {
  const {
    port = 8787,
    hostname = 'localhost',
  } = options;

  const server = Bun.serve({
    port,
    hostname,
    fetch: (req) => app.fetch(req, {} as any), // Empty object - settings come from config module
  });

  const actualPort = server.port;

  if (!actualPort) {
    throw new Error('Server failed to bind to a port');
  }

  const url = `http://${hostname}:${actualPort}`;

  // Wait for server to be ready
  await waitForServer(`${url}/health`);

  return {
    server,
    port: actualPort,
    url,
    stop: () => server.stop(),
  };
}

/**
 * Wait for server to be ready by polling health endpoint
 */
async function waitForServer(
  url: string,
  maxAttempts = 10,
  delayMs = 100
): Promise<void> {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // Server not ready yet
    }
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
  throw new Error(`Server not ready at ${url} after ${maxAttempts} attempts`);
}
