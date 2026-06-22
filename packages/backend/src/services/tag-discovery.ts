import { gte } from "drizzle-orm";
import type { DatabaseClient } from "../database/client";
import { contacts, tags } from "../database/schema";
import {
  loadNotedContacts,
  discoverDynamicTagsFromNotes,
  assignDiscoveredTagsToContacts,
} from "./tags";

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Run dynamic-tag discovery + batched assignment for a single user.
 *
 * The user's noted contacts are loaded and decrypted once, then shared by both
 * passes: pass 1 discovers candidate tags from the whole note set (returned as
 * an in-memory array), pass 2 assigns them across the contacts.
 * Tag rows are pre-created here so the assignment pass only needs to SELECT.
 * Shared by the daily cron and the manual `/tags/discover` route.
 */
export async function discoverAndAssignForUser(
  db: DatabaseClient,
  userId: string,
): Promise<{ discovered: string[]; assignedContacts: number }> {
  const noted = await loadNotedContacts(db, userId);
  if (noted.length === 0) return { discovered: [], assignedContacts: 0 };

  const discovered = await discoverDynamicTagsFromNotes(
    noted.map((c) => c.notes),
  );
  if (discovered.length === 0) return { discovered: [], assignedContacts: 0 };

  // Ensure tag rows exist before the assignment pass reads them.
  await db
    .insert(tags)
    .values(discovered.map((name) => ({ userId, name })))
    .onConflictDoNothing();

  const assignedContacts = await assignDiscoveredTagsToContacts(
    db,
    userId,
    noted,
    discovered,
  );
  return { discovered, assignedContacts };
}

/**
 * Daily cron entry point: process every user with a contact created or updated
 * in the last 24h. `updatedAt` defaults to `createdAt` and is bumped on update,
 * so a single check covers both. One user's failure never aborts the batch.
 * Returns the number of active users processed.
 */
export async function runDailyTagDiscovery(
  db: DatabaseClient,
): Promise<number> {
  const cutoff = new Date(Date.now() - ONE_DAY_MS);

  // `db` is a union of the D1 and bun-sqlite Drizzle types whose overloaded
  // select signatures don't unify, so cast the builder (as the codebase does
  // elsewhere) and re-type the result.
  const active = (await (db as any)
    .selectDistinct({ userId: contacts.userId })
    .from(contacts)
    .where(gte(contacts.updatedAt, cutoff))) as { userId: string }[];

  for (const { userId } of active) {
    try {
      await discoverAndAssignForUser(db, userId);
    } catch (err) {
      console.error("[tag-discovery] user failed:", userId, err);
    }
  }

  return active.length;
}
