/**
 * Backend boot script — runs under Bun (NOT Jest).
 *
 * Starts a real backend server with a test SQLite database,
 * seeds test data, and writes connection info to a JSON file.
 * The shell runner (run-tests.sh) starts this before Jest launches.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { eq } from 'drizzle-orm';
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

  // 3b. Seed a test relationship between Contact 1 and Contact 2
  const [user] = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.externalId, 'test-user-1'))
    .limit(1);

  const userContacts = await db
    .select()
    .from(schema.contacts)
    .where(eq(schema.contacts.userId, user.id))
    .limit(2);

  if (userContacts.length >= 2) {
    // Insert forward row
    const [fwd] = await db
      .insert(schema.contactRelationships)
      .values({
        userId: user.id,
        contactId: userContacts[0].id,
        relatedContactId: userContacts[1].id,
        type: 'friend',
        sentiment: 2,
        description: 'Met at a conference',
      })
      .returning();

    // Insert reverse row
    const [rev] = await db
      .insert(schema.contactRelationships)
      .values({
        userId: user.id,
        contactId: userContacts[1].id,
        relatedContactId: userContacts[0].id,
        type: 'friend',
        sentiment: 2,
        description: 'Met at a conference',
        mirrorId: fwd.id,
      })
      .returning();

    // Link forward to reverse
    await db
      .update(schema.contactRelationships)
      .set({ mirrorId: rev.id })
      .where(eq(schema.contactRelationships.id, fwd.id));
  }

  // 3c. Give some contacts notes and avatarUrl for memory reps
  const allContacts = await db
    .select()
    .from(schema.contacts)
    .where(eq(schema.contacts.userId, user.id));

  if (allContacts.length >= 4) {
    await db
      .update(schema.contacts)
      .set({ notes: 'Works at Acme Corp as a product manager', avatarUrl: 'https://ui-avatars.com/api/?name=Contact+1&background=4F46E5&color=fff' })
      .where(eq(schema.contacts.id, allContacts[0].id));

    await db
      .update(schema.contacts)
      .set({ notes: 'Stanford CS grad, plays guitar', avatarUrl: 'https://ui-avatars.com/api/?name=Contact+2&background=10B981&color=fff' })
      .where(eq(schema.contacts.id, allContacts[1].id));

    await db
      .update(schema.contacts)
      .set({ avatarUrl: 'https://ui-avatars.com/api/?name=Contact+3&background=F59E0B&color=fff' })
      .where(eq(schema.contacts.id, allContacts[2].id));

    await db
      .update(schema.contacts)
      .set({ avatarUrl: 'https://ui-avatars.com/api/?name=Contact+4&background=EF4444&color=fff' })
      .where(eq(schema.contacts.id, allContacts[3].id));

    // 3d. Seed memory reps directly (no LLM needed)
    // Detail type reps
    await db.insert(schema.memoryReps).values({
      userId: user.id,
      contactId: allContacts[0].id,
      question: 'Where does Contact 1 work?',
      options: ['Acme Corp', 'Google', 'Meta', 'Apple'],
      correctAnswer: 0,
      sourceField: 'notes',
      questionType: 'detail',
    });

    await db.insert(schema.memoryReps).values({
      userId: user.id,
      contactId: allContacts[1].id,
      question: 'Where did Contact 2 study?',
      options: ['MIT', 'Stanford', 'Harvard', 'Yale'],
      correctAnswer: 1,
      sourceField: 'notes',
      questionType: 'detail',
    });

    // Identify type reps
    await db.insert(schema.memoryReps).values({
      userId: user.id,
      contactId: allContacts[0].id,
      question: 'Who is this person?',
      options: ['Contact 1', 'Contact 2', 'Contact 3', 'Contact 4'],
      correctAnswer: 0,
      sourceField: 'avatar',
      questionType: 'identify',
    });

    await db.insert(schema.memoryReps).values({
      userId: user.id,
      contactId: allContacts[1].id,
      question: 'Who is this person?',
      options: ['Contact 3', 'Contact 2', 'Contact 4', 'Contact 1'],
      correctAnswer: 1,
      sourceField: 'avatar',
      questionType: 'identify',
    });
  }

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
