import { and, eq } from "drizzle-orm";
import { userPreferences } from "../database/schema";
import type { DatabaseClient } from "../database/client";

export enum PrefKey {
  MemRepInitialDelayHours = "memRepInitialDelayHours",
}

export interface PrefValues {
  [PrefKey.MemRepInitialDelayHours]: number;
}

export const PREF_DEFAULTS: PrefValues = {
  [PrefKey.MemRepInitialDelayHours]: 72,
};

/**
 * Fetch a single stored preference for a user, falling back to the default.
 *
 * The stored `value` column is typed `unknown` (it holds JSON for any key),
 * so this is the single trusted boundary where it is narrowed to the key's type.
 */
export async function getPreferenceValue<K extends PrefKey>(
  db: DatabaseClient,
  userId: string,
  key: K,
): Promise<PrefValues[K]> {
  const [row] = await db
    .select()
    .from(userPreferences)
    .where(
      and(eq(userPreferences.userId, userId), eq(userPreferences.key, key)),
    )
    .limit(1);
  return (row?.value as PrefValues[K] | undefined) ?? PREF_DEFAULTS[key];
}
