import { spawn } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';

const INFO_FILE = path.join(__dirname, '.test-server-info.json');
const TIMEOUT_MS = 15_000;

/** Resolve bun binary path */
function findBun(): string {
  const { HOME = '/root' } = process.env;
  const candidates = [
    path.join(HOME, '.bun', 'bin', 'bun'),
    '/usr/local/bin/bun',
  ];
  for (const p of candidates) {
    try {
      fs.accessSync(p, fs.constants.X_OK);
      return p;
    } catch {
      // try next
    }
  }
  return 'bun';
}

export default async function globalSetup() {
  // Clean any stale info file
  try { fs.unlinkSync(INFO_FILE); } catch {}

  const backendCwd = path.resolve(__dirname, '../../backend');
  const bootScript = path.resolve(__dirname, 'backend-boot.ts');
  const bunPath = findBun();

  return new Promise<void>((resolve, reject) => {
    const child = spawn(bunPath, ['run', bootScript], {
      cwd: backendCwd,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, NODE_ENV: 'test' },
    });

    let stderr = '';

    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error(`Backend boot timed out after ${TIMEOUT_MS}ms.\nstderr: ${stderr}`));
    }, TIMEOUT_MS);

    // backend-boot.ts writes the info file directly; poll for it
    const poll = setInterval(() => {
      if (fs.existsSync(INFO_FILE)) {
        clearInterval(poll);
        clearTimeout(timer);
        const info = JSON.parse(fs.readFileSync(INFO_FILE, 'utf-8'));
        console.log(`[globalSetup] Backend ready at ${info.url}`);
        resolve();
      }
    }, 200);

    child.stderr?.on('data', (chunk: Buffer) => {
      stderr += chunk.toString();
    });

    child.on('error', (err) => {
      clearInterval(poll);
      clearTimeout(timer);
      reject(new Error(`Failed to spawn backend: ${err.message}`));
    });

    child.on('exit', (code) => {
      clearInterval(poll);
      clearTimeout(timer);
      if (code !== 0 && code !== null && !fs.existsSync(INFO_FILE)) {
        reject(new Error(`Backend exited with code ${code}.\nstderr: ${stderr}`));
      }
    });
  });
}
