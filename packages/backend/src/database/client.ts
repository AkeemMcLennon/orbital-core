import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema";
import type { DatabaseProvider } from "./provider";
import type { Env } from "../types/env";
import { settings } from "../config";

export type DatabaseClient =
  | ReturnType<typeof createDbClient>
  | Awaited<ReturnType<typeof createLocalDbClient>>;

// For Cloudflare Workers (D1)
export function createDbClient(d1: D1Database) {
  return drizzle(d1, { schema });
}

// For local development (SQLite file using Bun's native SQLite)
// Uses dynamic import to avoid bundling bun:sqlite for Workers
export async function createLocalDbClient(dbPath: string = "./local.db") {
  try {
    const { drizzle: drizzleBunSqlite } =
      await import("drizzle-orm/bun-sqlite");
    const { Database } = await import("bun:sqlite").catch(() => {
      throw new Error(
        "bun:sqlite is only available in Bun runtime. Use DB_PROVIDER=d1 for Cloudflare Workers.",
      );
    });
    const sqlite = new Database(dbPath);
    return drizzleBunSqlite(sqlite, { schema });
  } catch (error) {
    throw new Error(
      `Failed to initialize local SQLite client: ${(error as Error).message}`,
    );
  }
}

// Smart client creator - switches based on provider
export async function getDbClient(options: {
  provider: DatabaseProvider;
  d1?: D1Database;
  sqlitePath?: string;
}): Promise<DatabaseClient> {
  if (options.provider === "d1") {
    if (!options.d1) {
      throw new Error("D1 database binding required when provider is d1");
    }
    return createDbClient(options.d1);
  }

  return await createLocalDbClient(options.sqlitePath);
}

/**
 * Context available when resolving the database for a request: the runtime
 * environment (bindings/vars) and the request's verified tenant claim, if any.
 */
export interface DbResolutionContext {
  env: Env;
  tenantId: string | null;
}

/**
 * Strategy for obtaining the DatabaseClient a request should use. The default
 * (below) selects D1 or SQLite from the environment; deployments can inject an
 * alternative strategy via createApp().
 */
export type DbResolver = (ctx: DbResolutionContext) => Promise<DatabaseClient>;

/**
 * Default resolver: D1 when the binding is present (Cloudflare Workers),
 * otherwise the configured provider (sqlite for local/dev/test).
 */
export const defaultDbResolver: DbResolver = ({ env }) =>
  getDbClient({
    provider: env.DB ? "d1" : settings.DB_PROVIDER,
    d1: env.DB,
    sqlitePath: settings.SQLITE_DB_PATH,
  });
