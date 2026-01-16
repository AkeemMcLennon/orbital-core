import type { Config } from 'drizzle-kit';

// Local SQLite configuration for development using Bun's native SQLite
export default {
  schema: './src/database/schema/index.ts',
  out: './src/database/migrations',
  dialect: 'sqlite',
  dbCredentials: {
    url: './local.db',
  },
  verbose: true,
  strict: true,
} satisfies Config;
