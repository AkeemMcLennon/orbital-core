import { ORPCError } from '@orpc/server';
import { eq, and } from 'drizzle-orm';
import * as z from 'zod';
import { deletionQueue } from '../database/schema';
import { authProc } from '../middleware/auth';
import { queueAccountDeletion } from '../services/account-deletion';

export const requestDeletion = authProc
  .route({
    method: 'POST',
    path: '/account/request-deletion',
    summary: 'Request account deletion',
    operationId: 'requestAccountDeletion',
  })
  .output(
    z.object({
      scheduledDeleteAt: z.string().datetime(),
      message: z.string(),
    }),
  )
  .handler(async ({ context }) => {
    const { user, db } = context;

    const [existing] = await db
      .select()
      .from(deletionQueue)
      .where(and(eq(deletionQueue.userId, user.id), eq(deletionQueue.status, 'pending')))
      .limit(1);

    if (existing) {
      throw new ORPCError('CONFLICT', {
        message: 'A deletion request is already pending for this account.',
      });
    }

    const scheduledDeleteAt = await queueAccountDeletion(db, user.id);

    return {
      scheduledDeleteAt: scheduledDeleteAt.toISOString(),
      message:
        'Your account will be permanently deleted in 14 days. Log back in at any time to cancel.',
    };
  });

export const router = { requestDeletion };
export default router;
