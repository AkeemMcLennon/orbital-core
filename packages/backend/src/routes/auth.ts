import { authProc } from "../middleware/auth";
import * as z from "zod";
import { dateField } from "./schema-helpers";

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
      tenantId: z.string().nullable(),
      email: z.string(),
      name: z.string().nullable(),
      createdAt: dateField(),
    }),
  )
  .handler(async ({ context }) => {
    const { user, tenantId } = context;

    return {
      userId: user.id,
      externalId: user.externalId,
      tenantId,
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
