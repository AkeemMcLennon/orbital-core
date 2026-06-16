import * as z from "zod";
import { authProc } from "../middleware/auth";
import {
  meilisearchService,
  isMeilisearchConfigured,
  MEILISEARCH_INDEX_NAME,
} from "../services/meilisearch";
import { settings } from "../config";

export const getSettings = authProc
  .route({
    method: "GET",
    path: "/settings",
    summary: "Get tenant-specific configuration for the current user",
    operationId: "getSettings",
  })
  .output(
    z.object({
      search: z
        .object({
          url: z.string(),
          token: z.string(),
          indexName: z.string(),
        })
        .nullable(),
    }),
  )
  .handler(async ({ context }) => {
    const { user } = context;

    if (!isMeilisearchConfigured()) {
      return { search: null };
    }

    return {
      search: {
        url: settings.MEILISEARCH_URL!,
        token: await meilisearchService.generateTenantToken(user.id),
        indexName: MEILISEARCH_INDEX_NAME,
      },
    };
  });

export const router = {
  getSettings,
};

export default router;
