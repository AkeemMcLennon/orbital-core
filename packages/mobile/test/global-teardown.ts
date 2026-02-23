import * as fs from 'node:fs';
import * as path from 'node:path';

const INFO_FILE = path.join(__dirname, '.test-server-info.json');

export default async function globalTeardown() {
  // Cleanup is handled by run-tests.sh via trap.
  // But if the info file has a PID, try to clean up here too as a safety net.
  try {
    const raw = fs.readFileSync(INFO_FILE, 'utf-8');
    const { pid } = JSON.parse(raw);
    if (pid) {
      try {
        process.kill(pid, 'SIGTERM');
      } catch {
        // Already exited
      }
    }
  } catch {
    // File missing — nothing to do
  } finally {
    try {
      fs.unlinkSync(INFO_FILE);
    } catch {
      // Already cleaned up
    }
  }
}
