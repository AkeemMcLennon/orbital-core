import { Database } from 'bun:sqlite';
import { drizzle } from 'drizzle-orm/bun-sqlite';
import { eq } from 'drizzle-orm';
import * as schema from '../../src/database/schema';
import type { DatabaseClient } from '../../src/database/client';
import { readFileSync, readdirSync, unlinkSync, existsSync } from 'fs';
import { join } from 'path';
import { randomUUID } from 'crypto';

const TEST_DB_PATH = './test.db';

/**
 * Create test SQLite database with schema applied
 */
export async function createTestDatabase(): Promise<DatabaseClient> {
  // Remove existing test database if it exists
  if (existsSync(TEST_DB_PATH)) {
    unlinkSync(TEST_DB_PATH);
  }

  // Create test database file
  const sqlite = new Database(TEST_DB_PATH);
  const db = drizzle(sqlite, { schema });

  // Apply migrations
  await applyMigrations(sqlite);

  return db;
}

/**
 * Apply all migrations to database
 */
async function applyMigrations(sqlite: Database): Promise<void> {
  const migrationsPath = join(
    __dirname,
    '../../src/database/migrations'
  );

  // Read all migration files in order
  const migrationFiles = readdirSync(migrationsPath)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  for (const file of migrationFiles) {
    const sql = readFileSync(join(migrationsPath, file), 'utf-8');
    sqlite.exec(sql);
  }
}

/**
 * Clear all data from database (keep schema)
 */
export async function clearDatabase(db: DatabaseClient): Promise<void> {
  // Delete in order to respect foreign key constraints
  await db.delete(schema.contactTags);
  await db.delete(schema.contacts);
  await db.delete(schema.tags);
  await db.delete(schema.directory);
  await db.delete(schema.users);
}

/**
 * Seed test user
 */
export async function seedTestUser(
  db: DatabaseClient,
  userId: string,
  data?: Partial<typeof schema.users.$inferInsert>
): Promise<void> {
  await db.insert(schema.users).values({
    id: randomUUID(), // Generate internal ID
    externalId: userId, // Use provided userId as external_id
    email: data?.email ?? `${userId}@example.com`,
    name: data?.name ?? 'Test User',
    ...data,
  });
}

/**
 * Seed test contacts
 * @param db - Database client
 * @param userExternalId - The externalId of the user (from JWT sub)
 * @param count - Number of contacts to create
 */
export async function seedTestContacts(
  db: DatabaseClient,
  userExternalId: string,
  count: number = 5
): Promise<void> {
  // Look up the user by externalId to get their database ID
  const [user] = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.externalId, userExternalId))
    .limit(1);

  if (!user) {
    throw new Error(`User with externalId ${userExternalId} not found. Make sure to seed the user first.`);
  }

  const contacts = Array.from({ length: count }, (_, i) => ({
    userId: user.id, // Use the database user ID
    name: `Contact ${i + 1}`,
    email: `contact${i + 1}@example.com`,
    group: (i % 3 === 0 ? 'work' : 'personal') as 'work' | 'personal',
  }));

  await db.insert(schema.contacts).values(contacts);
}

/**
 * Seed test directory entries
 * @param db - Database client
 * @param userExternalId - The externalId of the user (from JWT sub)
 * @param count - Number of directory entries to create
 */
export async function seedTestDirectory(
  db: DatabaseClient,
  userExternalId: string,
  count: number = 5
): Promise<void> {
  // Look up the user by externalId to get their database ID
  const [user] = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.externalId, userExternalId))
    .limit(1);

  if (!user) {
    throw new Error(`User with externalId ${userExternalId} not found. Make sure to seed the user first.`);
  }

  const entries = Array.from({ length: count }, (_, i) => ({
    userId: user.id,
    source: 'manual',
    name: `Available Contact ${i + 1}`,
    email: `available${i + 1}@example.com`,
    company: i % 2 === 0 ? 'Company A' : 'Company B',
    activeContactId: null,
  }));

  await db.insert(schema.directory).values(entries);
}
