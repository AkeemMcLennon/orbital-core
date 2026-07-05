import { uuidv7 } from "uuidv7";
import { parse } from "uuid";
import bs58 from "bs58";

/**
 * Generate a new UUIDv7 encoded as a Base58 string — the app-layer ID format
 * shared across services (contacts, tenants, etc.). Time-ordered (UUIDv7) and
 * URL-safe/short (Base58).
 */
export const generateId = (): string => {
  // `parse` returns a Uint8Array (16 bytes); bs58.encode accepts it directly, so
  // no Buffer is needed — keeps this portable to the Workers runtime.
  return bs58.encode(parse(uuidv7()));
};
