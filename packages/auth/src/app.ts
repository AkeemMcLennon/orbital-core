import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { oauthProviderOpenIdConfigMetadata } from "@better-auth/oauth-provider";
import { createAuth } from "./auth";
import { ensureMobileClient } from "./seed-clients";
import type { Env } from "./types/env";

const app = new Hono<{ Bindings: Env }>();

app.use("*", logger());

app.use(
  "*",
  cors({
    origin: "*",
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
    exposeHeaders: ["Content-Length"],
    maxAge: 86400,
  }),
);

// Health check
app.get("/health", (c) => {
  return c.json({ status: "ok", service: "orbital-auth" });
});

// OIDC Discovery
app.get("/.well-known/openid-configuration", async (c) => {
  const auth = createAuth(c.env);
  const handler = oauthProviderOpenIdConfigMetadata(auth);
  return await handler(c.req.raw);
});

// Global error handler — log unhandled exceptions
app.onError((err, c) => {
  console.error("[auth] Unhandled error:", err.message, err.stack);
  return c.json(
    { error: "internal_error", error_description: err.message },
    500,
  );
});

// BetterAuth handles all routes at the root basePath
app.all("/*", async (c) => {
  // Ensure the mobile OAuth client exists (idempotent, runs once per isolate)
  await ensureMobileClient(c.env.DB);
  const auth = createAuth(c.env);
  return await auth.handler(c.req.raw);
});

export default app;
