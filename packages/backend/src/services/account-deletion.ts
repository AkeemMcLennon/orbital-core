import { eq, and, lte } from 'drizzle-orm';
import { deletionQueue, users } from '../database/schema';
import type { DatabaseClient } from '../database/client';

const FOURTEEN_DAYS_S = 14 * 24 * 60 * 60;

export async function queueAccountDeletion(db: DatabaseClient, userId: string): Promise<Date> {
  const now = Math.floor(Date.now() / 1000);
  const scheduledDeleteAt = new Date((now + FOURTEEN_DAYS_S) * 1000);

  await db.insert(deletionQueue).values({
    id: crypto.randomUUID(),
    userId,
    scheduledDeleteAt,
  });

  return scheduledDeleteAt;
}

export async function cancelPendingDeletion(db: DatabaseClient, userId: string): Promise<void> {
  await db
    .update(deletionQueue)
    .set({ status: 'canceled' })
    .where(and(eq(deletionQueue.userId, userId), eq(deletionQueue.status, 'pending')));
}

export async function processAccountDeletions(db: DatabaseClient): Promise<number> {
  const now = new Date();

  const due = await db
    .select()
    .from(deletionQueue)
    .where(and(eq(deletionQueue.status, 'pending'), lte(deletionQueue.scheduledDeleteAt, now)));

  for (const entry of due) {
    await db.delete(users).where(eq(users.id, entry.userId));
  }

  return due.length;
}
