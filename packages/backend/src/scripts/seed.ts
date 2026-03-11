import { Database } from 'bun:sqlite';
import { existsSync } from 'fs';
import { join } from 'path';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/bun-sqlite';
import { migrate } from 'drizzle-orm/bun-sqlite/migrator';
import * as schema from '../database/schema';
import { generateBase58Id, generateAvatarUrl } from '../database/seed-helpers';
import { shuffle } from 'es-toolkit';
import { createTestToken } from '@orbital/testing/backend/auth';

const SEED_DB_PATH = './seed.db';
const shouldReset = process.argv.includes('--reset');

/**
 * Apply migrations to a database using Drizzle's native migrator
 */
async function applyMigrations(dbPath: string): Promise<void> {
  console.log(`\n🔄 Running migrations on ${dbPath}...`);

  const sqlite = new Database(dbPath);
  const db = drizzle(sqlite, { schema });

  const migrationsFolder = join(import.meta.dir, '../database/migrations');

  try {
    await migrate(db, {
      migrationsFolder,
    });
    console.log('✅ All migrations applied successfully\n');
  } catch (error) {
    console.error('Migration failed:', error);
    throw error;
  } finally {
    sqlite.close();
  }
}

/**
 * Check if database needs initialization
 */
function needsInit(): boolean {
  return !existsSync(SEED_DB_PATH) || shouldReset;
}

/**
 * Seed the database with realistic development data
 */
async function seedDatabase(): Promise<void> {
  // Initialize database if needed
  if (needsInit()) {
    if (existsSync(SEED_DB_PATH) && shouldReset) {
      console.log(`\n🗑️  Clearing existing seed.db...`);
      const file = Bun.file(SEED_DB_PATH);
      if (await file.exists()) {
        Bun.spawnSync(['rm', SEED_DB_PATH]);
      }
    }
    await applyMigrations(SEED_DB_PATH);
  }

  console.log('🌱 Seeding database with realistic development data...\n');

  // Create fresh database connection for seeding
  const sqlite = new Database(SEED_DB_PATH);
  const db = drizzle(sqlite, { schema });

  // Phase 1: Create test users
  console.log('📊 Phase 1: Creating test users...');

  const testUsers = [
    {
      id: Bun.randomUUIDv7(),
      externalId: 'test-user-001',
      email: 'test@example.com',
      name: 'Test User',
    },
    {
      id: Bun.randomUUIDv7(),
      externalId: 'demo-user-002',
      email: 'demo@example.com',
      name: 'Demo User',
    },
  ];

  for (const user of testUsers) {
    await db.insert(schema.users).values(user);
  }

  console.log(`✅ Created ${testUsers.length} users\n`);

  // Phase 2: Create tags for each user
  console.log('🏷️  Phase 2: Creating tags...');

  const tagNames = [
    'Work Relationships',
    'Personal Network',
    'VCs & Angels',
    'Founders',
  ];

  const tagColors = ['#3B82F6', '#EF4444', '#10B981', '#F59E0B'];

  const userTags: Record<string, string[]> = {};

  for (const user of testUsers) {
    const tags: string[] = [];
    for (let i = 0; i < 2; i++) {
      const tagId = generateBase58Id();
      tags.push(tagId);
      await db.insert(schema.tags).values({
        id: tagId,
        userId: user.id,
        name: tagNames[i % tagNames.length],
        color: tagColors[i % tagColors.length],
      });
    }
    userTags[user.id] = tags;
  }

  console.log(`✅ Created ${Object.values(userTags).flat().length} tags\n`);

  // Phase 3: Create contacts for each user
  console.log('📇 Phase 3: Creating contacts...');

  const contactNames = [
    'Alice Johnson',
    'Bob Smith',
    'Carol Williams',
    'David Brown',
    'Emma Davis',
    'Frank Miller',
    'Grace Lee',
    'Henry Wilson',
    'Isabella Martinez',
    'Jack Anderson',
  ];

  const jobTitles = [
    'CEO',
    'CTO',
    'Product Manager',
    'Engineer',
    'Designer',
    'Founder',
    'Investor',
    'Sales Manager',
    'Marketing Lead',
    'Data Analyst',
  ];

  const companies = [
    'Tech Startup Inc',
    'Innovation Labs',
    'Digital Solutions',
    'Cloud Systems',
    'AI Ventures',
    'Data Science Co',
    'Future Tech',
    'Smart Software',
    'Web Services Ltd',
    'Mobile Apps Co',
  ];

  const userContacts: Record<string, string[]> = {};

  for (const user of testUsers) {
    const contacts: string[] = [];
    for (let i = 0; i < 10; i++) {
      const contactId = generateBase58Id();
      contacts.push(contactId);

      const email = `contact-${user.externalId}-${i + 1}@example.com`;
      const phone = `+1-${String(Math.floor(Math.random() * 900) + 100).padStart(3, '0')}-${String(Math.floor(Math.random() * 9000) + 1000).padStart(4, '0')}`;

      const contactName = contactNames[i % contactNames.length];
      await db.insert(schema.contacts).values({
        id: contactId,
        userId: user.id,
        name: contactName,
        email: email,
        phone: phone,
        avatarUrl: generateAvatarUrl(contactName),
        jobTitle: jobTitles[i % jobTitles.length],
        company: companies[i % companies.length],
        notes: `Key contact from ${companies[i % companies.length]}. Important relationship to maintain.`,
        group: i % 3 === 0 ? 'work' : 'personal',
        lastInteractionAt: new Date(Date.now() - Math.random() * 180 * 24 * 60 * 60 * 1000),
      });
    }
    userContacts[user.id] = contacts;
  }

  console.log(`✅ Created ${Object.values(userContacts).flat().length} contacts\n`);

  // Phase 4: Create directory entries
  console.log('📋 Phase 4: Creating directory entries...');

  const userDirectory: Record<string, string[]> = {};

  for (const user of testUsers) {
    const dirEntries: string[] = [];
    for (let i = 0; i < 6; i++) {
      const dirId = generateBase58Id();
      dirEntries.push(dirId);

      const email = `available-${user.externalId}-${i + 1}@example.com`;
      const phone = `+1-${String(Math.floor(Math.random() * 900) + 100).padStart(3, '0')}-${String(Math.floor(Math.random() * 9000) + 1000).padStart(4, '0')}`;
      const directoryName = `Available ${contactNames[(i + 5) % contactNames.length]}`;

      await db.insert(schema.directory).values({
        id: dirId,
        userId: user.id,
        activeContactId: null,
        source: i % 3 === 0 ? 'google' : i % 3 === 1 ? 'manual' : 'linkedin',
        externalId: `ext-${user.externalId}-${i + 1}`,
        name: directoryName,
        email: email,
        phone: phone,
        avatarUrl: generateAvatarUrl(directoryName),
        company: companies[(i + 3) % companies.length],
      });
    }
    userDirectory[user.id] = dirEntries;
  }

  console.log(`✅ Created ${Object.values(userDirectory).flat().length} directory entries\n`);

  // Phase 5: Link some directory entries to contacts (promoted pointer pattern)
  console.log('🔗 Phase 5: Setting up directory → contact relationships...');

  for (const user of testUsers) {
    const dirEntries = userDirectory[user.id];
    const contacts = userContacts[user.id];

    // Promote 3 directory entries to contacts
    for (let i = 0; i < 3 && i < dirEntries.length && i < contacts.length; i++) {
      await db
        .update(schema.directory)
        .set({ activeContactId: contacts[i] })
        .where(eq(schema.directory.id, dirEntries[i]));
    }
  }

  console.log('✅ Linked directory entries to contacts\n');

  // Phase 6: Create contact-tag associations
  console.log('🏷️  Phase 6: Creating contact-tag associations...');

  let tagAssociationCount = 0;

  for (const user of testUsers) {
    const contacts = userContacts[user.id];
    const tags = userTags[user.id];

    for (const contactId of contacts) {
      // Randomly assign 1-3 tags per contact
      const tagCount = Math.floor(Math.random() * 3) + 1;
      const shuffledTags = shuffle(tags);

      for (let i = 0; i < tagCount && i < shuffledTags.length; i++) {
        try {
          await db.insert(schema.contactTags).values({
            contactId: contactId,
            tagId: shuffledTags[i],
          });
          tagAssociationCount++;
        } catch {
          // Skip if association already exists or constraint violation
        }
      }
    }
  }

  console.log(`✅ Created ${tagAssociationCount} contact-tag associations\n`);

  // Phase 7: Create relationships between contacts
  console.log('🤝 Phase 7: Creating contact relationships...');

  const relationshipDefs = [
    { a: 0, b: 1, type: 'friend', sentiment: 2, description: 'Met at a tech conference in 2023' },
    { a: 0, b: 2, type: 'colleague', sentiment: 1, description: 'Worked together at Innovation Labs' },
    { a: 1, b: 3, type: 'mentor', sentiment: 2, description: 'David mentored Bob early in his career' },
    { a: 2, b: 4, type: 'collaborator', sentiment: 1, description: 'Co-authored a research paper' },
    { a: 3, b: 5, type: 'rival', sentiment: -1, description: 'Competing for the same accounts' },
    { a: 4, b: 6, type: 'friend', sentiment: 2, description: 'College roommates' },
    { a: 5, b: 7, type: 'business partner', sentiment: 1, description: 'Co-founded a side project' },
    { a: 0, b: 8, type: 'acquaintance', sentiment: 0, description: 'Met briefly at a networking event' },
    { a: 6, b: 9, type: 'colleague', sentiment: 1, description: 'Same team at Digital Solutions' },
    { a: 7, b: 9, type: 'friend', sentiment: -2, description: 'Had a falling out over a deal' },
  ];

  let relationshipCount = 0;

  for (const user of testUsers) {
    const contactIds = userContacts[user.id];

    for (const rel of relationshipDefs) {
      if (rel.a >= contactIds.length || rel.b >= contactIds.length) continue;

      const forwardId = generateBase58Id();
      const reverseId = generateBase58Id();

      // Forward row (A → B)
      await db.insert(schema.contactRelationships).values({
        id: forwardId,
        userId: user.id,
        contactId: contactIds[rel.a],
        relatedContactId: contactIds[rel.b],
        type: rel.type,
        sentiment: rel.sentiment,
        description: rel.description,
        mirrorId: reverseId,
      });

      // Reverse row (B → A)
      await db.insert(schema.contactRelationships).values({
        id: reverseId,
        userId: user.id,
        contactId: contactIds[rel.b],
        relatedContactId: contactIds[rel.a],
        type: rel.type,
        sentiment: rel.sentiment,
        description: rel.description,
        mirrorId: forwardId,
      });

      relationshipCount++;
    }
  }

  console.log(`✅ Created ${relationshipCount} relationships (${relationshipCount * 2} rows)\n`);

  // Summary
  const allUsers = await db.select().from(schema.users);
  const allContacts = await db.select().from(schema.contacts);
  const allTags = await db.select().from(schema.tags);
  const allDirectory = await db.select().from(schema.directory);
  const allRelationships = await db.select().from(schema.contactRelationships);

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('✅ Seed completed successfully!\n');
  console.log(`📊 Seed Database Summary:`);
  console.log(`   Location: ${SEED_DB_PATH}`);
  console.log(`   Users: ${allUsers.length}`);
  console.log(`   Contacts: ${allContacts.length}`);
  console.log(`   Tags: ${allTags.length}`);
  console.log(`   Directory Entries: ${allDirectory.length}`);
  console.log(`   Contact-Tag Associations: ${tagAssociationCount}`);
  console.log(`   Relationships: ${allRelationships.length / 2} (${allRelationships.length} rows)`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // Generate and display test JWT token
  const firstUser = allUsers[0];
  const testToken = await createTestToken({
    sub: firstUser.externalId,
    email: firstUser.email,
  });

  console.log('🔐 Sample JWT Token for Testing:');
  console.log(`   User: ${firstUser.name} (${firstUser.email})`);
  console.log(`   Token:\n${testToken}\n`);

  sqlite.close();
}

// Run the seed
seedDatabase().catch((error) => {
  console.error('\n❌ Seed failed:', error);
  process.exit(1);
});
