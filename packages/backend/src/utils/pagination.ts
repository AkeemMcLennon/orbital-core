import { z } from "zod";

/**
 * Standard pagination input parameters
 */
export const PaginationInputSchema = z.object({
  limit: z.coerce.number().int().positive().max(100).default(50),
  offset: z.coerce.number().int().nonnegative().default(0),
});

/**
 * Metadata returned with paginated responses
 */
export const PaginationMetadataSchema = z.object({
  total: z.number(),
  limit: z.number(),
  offset: z.number(),
});

/**
 * Wraps an item schema in a standard paginated response structure
 */
export function paginatedSchema<T extends z.ZodType>(itemSchema: T) {
  return z.object({
    items: z.array(itemSchema),
    pagination: PaginationMetadataSchema,
  });
}
