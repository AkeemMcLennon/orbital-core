import { uuidv7 } from "uuidv7";
import { parse } from "uuid";
import bs58 from "bs58";
import { createHash } from "crypto";

/**
 * Generate a single UUIDv7 encoded as Base58
 * Matches the pk() helper's behavior in custom-types.ts
 */
export function generateBase58Id(): string {
  const uuid = uuidv7();
  const bytes = parse(uuid);
  return bs58.encode(Buffer.from(bytes));
}

/**
 * Generate multiple unique Base58 IDs
 */
export function generateBase58Ids(count: number): string[] {
  return Array.from({ length: count }, () => generateBase58Id());
}

/**
 * Generate a Pravatar.cc avatar URL for a given name
 * Returns a deterministic avatar URL that's the same for the same name
 * Format: https://i.pravatar.cc/{size}?u={identifier}&img={imageNumber}
 */
export function generateAvatarUrl(name: string, size: number = 150): string {
  // Normalize the input name
  const normalizedName = (name || "Unknown Contact")
    .trim()
    .replace(/\s+/g, " ") // Collapse multiple spaces
    .substring(0, 50); // Limit length for URL safety

  // Handle empty names
  if (!normalizedName) {
    return `https://i.pravatar.cc/${size}?u=anonymous`;
  }

  // Compute MD5 hash of the normalized name for consistent image selection
  const hash = createHash("md5").update(normalizedName.toLowerCase()).digest("hex");

  // Derive image number (1-70) from hash for variety
  const hashValue = parseInt(hash.substring(0, 8), 16);
  const img = (hashValue % 70) + 1;

  // Use the normalized name as the unique identifier for consistent avatars
  const encodedIdentifier = encodeURIComponent(normalizedName.toLowerCase());

  return `https://i.pravatar.cc/${size}?u=${encodedIdentifier}&img=${img}`;
}
