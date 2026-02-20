import app from "./app";
import { type Env } from "./types/env";
import { setWaitUntil } from "./utils/wait-until";

export default {
  fetch(req: Request, env: Env, ctx: ExecutionContext) {
    setWaitUntil(ctx.waitUntil.bind(ctx));
    return app.fetch(req, env, ctx);
  },
};
