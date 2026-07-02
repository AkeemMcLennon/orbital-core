import { z } from "zod";

/**
 * A five-point integer scale shared by contact `strength` and relationship
 * `sentiment`: -2 (weakest/most negative) to 2 (strongest/most positive).
 */
export const fivePointScaleSchema = z.number().int().min(-2).max(2);

/** Same bounds, coercing from string — for GET query-string params. */
export const fivePointScaleQuerySchema = z.coerce.number().int().min(-2).max(2);
