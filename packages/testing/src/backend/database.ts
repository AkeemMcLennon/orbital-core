import { Database } from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { eq } from "drizzle-orm";
import { readFileSync, readdirSync, unlinkSync, existsSync } from "fs";
import { join } from "path";
import { randomUUID } from "crypto";
import type { DatabaseClient } from "@orbital/backend/src/database/client";

export interface TestDatabaseOptions {
  schema: Record<string, any>;
  migrationsPath: string;
  dbPath?: string;
}

/**
 * Create test SQLite database with schema applied
 */
export async function createTestDatabase(
  options: TestDatabaseOptions,
): Promise<DatabaseClient> {
  const { schema, migrationsPath, dbPath = "./test.db" } = options;

  // Remove existing test database if it exists
  if (existsSync(dbPath)) {
    unlinkSync(dbPath);
  }

  // Create test database file
  const sqlite = new Database(dbPath);
  const db = drizzle(sqlite, { schema });

  // Apply migrations
  await applyMigrations(sqlite, migrationsPath);

  return db;
}

/**
 * Apply all migrations to database
 */
async function applyMigrations(
  sqlite: Database,
  migrationsPath: string,
): Promise<void> {
  // Read all migration files in order
  const migrationFiles = readdirSync(migrationsPath)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  for (const file of migrationFiles) {
    const sql = readFileSync(join(migrationsPath, file), "utf-8");
    sqlite.exec(sql);
  }
}

export interface ClearDatabaseOptions {
  schema: Record<string, any>;
}

/**
 * Clear all data from database (keep schema)
 */
export async function clearDatabase(
  db: DatabaseClient,
  options: ClearDatabaseOptions,
): Promise<void> {
  const { schema } = options;

  // Delete in order to respect foreign key constraints
  if (schema.memoryReps) {
    await db.delete(schema.memoryReps);
  }
  if (schema.contactRelationships) {
    await db.delete(schema.contactRelationships);
  }
  await db.delete(schema.contactTags);
  await db.delete(schema.contacts);
  await db.delete(schema.tags);
  await db.delete(schema.directory);
  await db.delete(schema.users);
}

export interface SeedUserOptions {
  schema: Record<string, any>;
}

/**
 * Seed test user
 */
export async function seedTestUser(
  db: DatabaseClient,
  userId: string,
  options: SeedUserOptions,
  data?: any,
): Promise<void> {
  const { schema } = options;

  await db.insert(schema.users).values({
    id: randomUUID(),
    externalId: userId,
    email: data?.email ?? `${userId}@example.com`,
    name: data?.name ?? "Test User",
    ...data,
  });
}

export interface SeedContactsOptions {
  schema: Record<string, any>;
}

/**
 * Seed test contacts
 * @param db - Database client
 * @param userExternalId - The externalId of the user (from JWT sub)
 * @param options - Options including schema
 * @param count - Number of contacts to create
 */
export async function seedTestContacts(
  db: DatabaseClient,
  userExternalId: string,
  options: SeedContactsOptions,
  count: number = 5,
): Promise<void> {
  const { schema } = options;

  // Look up the user by externalId to get their database ID
  const [user] = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.externalId, userExternalId))
    .limit(1);

  if (!user) {
    throw new Error(
      `User with externalId ${userExternalId} not found. Make sure to seed the user first.`,
    );
  }

  const contacts = Array.from({ length: count }, (_, i) => ({
    userId: user.id,
    name: `Contact ${i + 1}`,
    email: `contact${i + 1}@example.com`,
    group: (i % 3 === 0 ? "work" : "personal") as "work" | "personal",
  }));

  await db.insert(schema.contacts).values(contacts);
}

export interface SeedDirectoryOptions {
  schema: Record<string, any>;
}

/**
 * Seed test directory entries
 * @param db - Database client
 * @param userExternalId - The externalId of the user (from JWT sub)
 * @param options - Options including schema
 * @param count - Number of directory entries to create
 */
export async function seedTestDirectory(
  db: DatabaseClient,
  userExternalId: string,
  options: SeedDirectoryOptions,
  count: number = 5,
): Promise<void> {
  const { schema } = options;

  // Look up the user by externalId to get their database ID
  const [user] = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.externalId, userExternalId))
    .limit(1);

  if (!user) {
    throw new Error(
      `User with externalId ${userExternalId} not found. Make sure to seed the user first.`,
    );
  }

  const entries = Array.from({ length: count }, (_, i) => ({
    userId: user.id,
    source: "manual",
    name: `Available Contact ${i + 1}`,
    email: `available${i + 1}@example.com`,
    company: i % 2 === 0 ? "Company A" : "Company B",
    activeContactId: null,
  }));

  await db.insert(schema.directory).values(entries);
}
