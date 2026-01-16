import type { DatabaseClient } from './client';
import { settings } from '../config';

export type DatabaseProvider = 'sqlite' | 'd1';

// Get database provider from settings
// No validation needed - already validated by zod schema in config.ts
export function getDatabaseProvider(): DatabaseProvider {
  return settings.DB_PROVIDER;
}
