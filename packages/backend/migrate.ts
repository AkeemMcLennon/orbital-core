import { migrate } from "drizzle-orm/bun-sqlite/migrator";
import { settings } from "./src/config";
import { join } from "path";

import { drizzle } from "drizzle-orm/bun-sqlite";
import { Database } from "bun:sqlite";

const sqlite = new Database(settings.SQLITE_DB_PATH);
const db = drizzle(sqlite);
const migrationsFolder = join(import.meta.dir, "src/database/migrations");
migrate(db, { migrationsFolder });
