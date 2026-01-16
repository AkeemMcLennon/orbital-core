import { Database } from 'bun:sqlite';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

const db = new Database('./local.db');

// Get all migration files and sort them
const migrationsDir = join(import.meta.dir, 'src/database/migrations');
const migrationFiles = readdirSync(migrationsDir)
  .filter(f => f.endsWith('.sql'))
  .sort();

if (migrationFiles.length === 0) {
  console.log('⚠️  No migration files found');
  process.exit(0);
}

console.log(`Found ${migrationFiles.length} migration file(s)`);

// Apply each migration in order
for (const file of migrationFiles) {
  console.log(`\nApplying: ${file}`);

  const migration = readFileSync(join(migrationsDir, file), 'utf-8');

  // Split by statement breakpoint and execute each statement
  const statements = migration
    .split('--> statement-breakpoint')
    .map(s => s.trim())
    .filter(s => s.length > 0);

  for (const statement of statements) {
    db.run(statement);
  }

  console.log(`✅ ${file} applied successfully`);
}

console.log('\n✅ All migrations applied successfully to local.db');
db.close();
