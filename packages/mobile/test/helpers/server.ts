import * as fs from 'node:fs';
import * as path from 'node:path';

interface ServerInfo {
  url: string;
  token: string;
}

let cached: ServerInfo | null = null;

/**
 * Reads server URL and auth token written by global-setup.
 */
export function getServerInfo(): ServerInfo {
  if (cached) return cached;

  const infoPath = path.join(__dirname, '..', '.test-server-info.json');
  const raw = fs.readFileSync(infoPath, 'utf-8');
  const { url, token } = JSON.parse(raw);
  cached = { url, token };
  return cached;
}
