import { authProc } from '../middleware/auth';

/**
 * Get current authenticated user information
 */
export const me = authProc
  .route({ method: 'GET', path: '/auth/me' })
  .handler(async ({ context }) => {
    const { user } = context;

    return {
      userId: user.id,
      externalId: user.externalId,
      email: user.email,
      name: user.name,
      createdAt: user.createdAt,
    };
  });

/**
 * Export auth router
 */
export const router = {
  me,
};

export default router;
