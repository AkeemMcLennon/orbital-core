import * as z from "zod";
import { eq, sql } from "drizzle-orm";
import { authProc } from "../middleware/auth";
import { userPreferences } from "../database/schema";
import type { UserPreference } from "../database/schema";
import { PrefKey, PREF_DEFAULTS } from "../services/preferences";
import type { PrefValues } from "../services/preferences";

const PreferencesSchema = z.object({
  memRepInitialDelayHours: z.number().int(),
});

const PreferencesUpdateSchema = z.object({
  memRepInitialDelayHours: z.number().int().min(0).max(720).optional(),
});

function buildPreferences(rows: UserPreference[]): PrefValues {
  const stored = new Map(rows.map((r) => [r.key, r.value]));
  return {
    memRepInitialDelayHours:
      (stored.get(PrefKey.MemRepInitialDelayHours) as number | undefined) ??
      PREF_DEFAULTS[PrefKey.MemRepInitialDelayHours],
  };
}

export const getPreferences = authProc
  .route({
    method: "GET",
    path: "/preferences",
    summary: "Get user preferences",
    operationId: "getPreferences",
  })
  .output(PreferencesSchema)
  .handler(async ({ context }) => {
    const { db, user } = context;
    const rows = await db
      .select()
      .from(userPreferences)
      .where(eq(userPreferences.userId, user.id));
    return buildPreferences(rows);
  });

export const updatePreferences = authProc
  .route({
    method: "PUT",
    path: "/preferences",
    summary: "Update user preferences",
    operationId: "updatePreferences",
  })
  .input(PreferencesUpdateSchema)
  .output(PreferencesSchema)
  .handler(async ({ input, context }) => {
    const { db, user } = context;
    const entries = Object.entries(input).filter(
      ([, v]) => v !== undefined,
    ) as [string, unknown][];

    if (entries.length > 0) {
      await db
        .insert(userPreferences)
        .values(
          entries.map(([key, value]) => ({
            userId: user.id,
            key,
            value,
            updatedAt: new Date(),
          })),
        )
        .onConflictDoUpdate({
          target: [userPreferences.userId, userPreferences.key],
          set: {
            value: sql`excluded.value`,
            updatedAt: sql`excluded.updated_at`,
          },
        });
    }

    const rows = await db
      .select()
      .from(userPreferences)
      .where(eq(userPreferences.userId, user.id));
    return buildPreferences(rows);
  });

export const router = {
  get: getPreferences,
  update: updatePreferences,
};

export default router;
