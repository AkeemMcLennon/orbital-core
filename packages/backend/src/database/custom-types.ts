import { customType } from "drizzle-orm/sqlite-core";
import bs58 from "bs58";
import { generateId } from "@orbital/utils";

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
    // Convert the stored bytes back to a Base58 string. Different SQLite
    // drivers surface BLOBs differently (Buffer/Uint8Array vs ArrayBuffer),
    // so normalize before encoding.
    const bytes = value instanceof ArrayBuffer ? new Uint8Array(value) : value;
    return bs58.encode(bytes);
  },
});

/**
 * Re-exported from @orbital/utils so services can pre-generate IDs (e.g. to
 * cross-link rows in a single atomic insert) using the exact same scheme as the
 * `pk()` column default — a single source of truth shared with the auth service.
 */
export { generateId };

/**
 * Primary key helper that generates a new UUIDv7 and encodes it as Base58
 */
export const pk = () => uuidV7("id").primaryKey().$defaultFn(generateId);
