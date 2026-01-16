import { z } from "zod";
import bs58 from "bs58";

/**
 * Base58 ID validator with minimum length requirement
 * Use this for validating UUIDv7 IDs encoded as Base58
 */
export const base58IdSchema = z
  .string()
  .min(1)
  .refine(
    (val) => {
      try {
        bs58.decode(val);
        return true;
      } catch {
        return false;
      }
    },
    {
      message: "Invalid Base58 ID format",
    },
  );
