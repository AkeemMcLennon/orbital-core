/**
 * Backend boot script — runs under Bun (NOT Jest).
 *
 * Starts a real backend server with a test SQLite database,
 * seeds test data, and writes connection info to a JSON file.
 * The shell runner (run-tests.sh) starts this before Jest launches.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { backend } from '@orbital/testing';
import { createTestToken } from '@orbital/testing/backend/auth';
import { loadSettings } from '@orbital/backend/src/config';
import { startServer } from '@orbital/backend/src/server';
import * as schema from '@orbital/backend/src/database/schema';

const MIGRATIONS_PATH = './src/database/migrations';

// The info file lives next to this script
const INFO_FILE = path.join(import.meta.dir, '.test-server-info.json');

async function boot() {
  // 1. Create test database
  const db = await backend.createTestDatabase({
    schema,
    migrationsPath: MIGRATIONS_PATH,
  });

  // 2. Start backend server on a random port
  const server = await backend.startTestServer({ startServer, loadSettings });

  // 3. Seed test data
  await backend.seedTestUser(db, 'test-user-1', { schema });
  await backend.seedTestContacts(db, 'test-user-1', { schema }, 5);

  // 4. Create a JWT token for the test user
  const token = await createTestToken({
    sub: 'test-user-1',
    email: 'test@example.com',
  });

  // 5. Write server info file so Jest can read it
  const info = { url: server.url, token, pid: process.pid };
  fs.writeFileSync(INFO_FILE, JSON.stringify(info));
  console.log(`Backend ready at ${server.url} (PID ${process.pid})`);

  // 6. Keep process alive until killed
  await new Promise(() => {});
}

boot().catch((err) => {
  console.error('Backend boot failed:', err);
  process.exit(1);
});
