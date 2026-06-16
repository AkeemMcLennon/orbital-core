import app from "./app";
import { type Env } from "./types/env";
import { getDbClient } from "./database/client";
import { processAccountDeletions } from "./services/account-deletion";

export default {
  fetch(req: Request, env: Env, ctx: ExecutionContext) {
    // The per-request waitUntil is derived from c.executionCtx in app.ts and
    // threaded through the handler context — see utils/wait-until.ts.
    return app.fetch(req, env, ctx);
  },

  async scheduled(_event: ScheduledEvent, env: Env, _ctx: ExecutionContext) {
    const db = await getDbClient({
      provider: env.DB ? "d1" : "sqlite",
      d1: env.DB,
    });
    const count = await processAccountDeletions(db);
    console.log(`[cron] Processed ${count} account deletion(s).`);
  },
};
