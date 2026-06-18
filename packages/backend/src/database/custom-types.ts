import { customType } from "drizzle-orm/sqlite-core";
import { uuidv7 } from "uuidv7";
import { parse } from "uuid";
import bs58 from "bs58";

/**
 * Custom Drizzle type for UUIDv7 stored as BLOB in SQLite
 * Application layer uses Base58 encoding for shorter, URL-safe IDs
 */
export const uuidV7 = customType<{ data: string; driverData: Buffer }>({
  dataType() {
    return "blob";
  },
  toDriver(value: string): Buffer {
    // Convert Base58 string to Buffer for storage
    return Buffer.from(bs58.decode(value));
  },
  fromDriver(value: Buffer): string {
    // Convert Buffer back to Base58 string
    return bs58.encode(value);
  },
});

/**
 * Generate a new UUIDv7 encoded as a Base58 string (the app-layer ID format).
 * Exported so services can pre-generate IDs (e.g. to cross-link rows in a single
 * atomic insert) using the exact same scheme as the `pk()` column default.
 */
export const generateId = (): string => {
  const bytes = parse(uuidv7());
  return bs58.encode(Buffer.from(bytes));
};

/**
 * Primary key helper that generates a new UUIDv7 and encodes it as Base58
 */
export const pk = () => uuidV7("id").primaryKey().$defaultFn(generateId);
