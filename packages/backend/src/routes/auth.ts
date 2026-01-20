import { authProc } from "../middleware/auth";
import * as z from "zod";

/**
 * Get current authenticated user information
 */
export const me = authProc
  .route({
    method: "GET",
    path: "/auth/me",
    summary: "Get current authenticated user information",
    operationId: "getAuthMe",
  })
  .output(
    z.object({
      userId: z.string(),
      externalId: z.string(),
      email: z.string(),
      name: z.string().nullable(),
      createdAt: z.union([z.date(), z.string().datetime()]).transform(val =>
        val instanceof Date ? val.toISOString() : val
      ),
    })
  )
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
