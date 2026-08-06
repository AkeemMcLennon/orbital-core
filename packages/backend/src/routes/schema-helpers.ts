import * as z from "zod";

/**
 * Date column serialized as an ISO 8601 string. Accepts a Date (Drizzle
 * timestamp columns) or an already-ISO string. The .pipe() declares the
 * transform's output schema — without it the OpenAPI converter emits {}
 * and Orval types the field `unknown`.
 */
export const dateField = () =>
  z
    .union([z.date(), z.iso.datetime()])
    .transform((val) => (val instanceof Date ? val.toISOString() : val))
    .pipe(z.iso.datetime());
