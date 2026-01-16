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
 * Primary key helper that generates a new UUIDv7 and encodes it as Base58
 */
export const pk = () =>
  uuidV7("id")
    .primaryKey()
    .$defaultFn(() => {
      // Generate UUIDv7, parse to bytes, encode as Base58
      const uuid = uuidv7();
      const bytes = parse(uuid);
      return bs58.encode(Buffer.from(bytes));
    });
