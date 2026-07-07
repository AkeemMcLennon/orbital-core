import { OpenAPIHandler } from "@orpc/openapi/fetch";
import { OpenAPIReferencePlugin } from "@orpc/openapi/plugins";
import { onError } from "@orpc/server";
import { CORSPlugin } from "@orpc/server/plugins";
import { ZodToJsonSchemaConverter } from "@orpc/zod/zod4";
import { Hono } from "hono";
import { logger } from "hono/logger";
import { loadSettings } from "./config";
import router from "./routes";
import { createGoogleOAuthRoutes } from "./routes/oauth/google";
import { Env } from "./types/env";
import { createWaitUntil, type WaitUntil } from "./utils/wait-until";
import { defaultDbResolver, type DbResolver } from "./database/client";

export interface CreateAppOptions {
  /**
   * How to obtain the DatabaseClient for each request. Defaults to the
   * built-in resolver, which selects D1 or SQLite from the environment.
   */
  dbResolver?: DbResolver;
}

/**
 * Build the Hono app. Kept as a factory (rather than a module singleton) so
 * deployments can customize per-request concerns like database resolution,
 * while the request path itself stays identical everywhere.
 */
export function createApp(options: CreateAppOptions = {}) {
  const resolveDb = options.dbResolver ?? defaultDbResolver;

  const app = new Hono<{ Bindings: Env }>();

  // Apply logger middleware
  app.use("*", logger());

  // Health check endpoint
  app.get("/health", (c) => {
    return c.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // Google OAuth callback handler (shares the app's db-resolution strategy)
  app.route("/auth", createGoogleOAuthRoutes(resolveDb));

  // Create OpenAPI handler with plugins
  const handler = new OpenAPIHandler(router, {
    plugins: [
      new CORSPlugin(),
      new OpenAPIReferencePlugin({
        docsProvider: "swagger",
        schemaConverters: [new ZodToJsonSchemaConverter()],
        specGenerateOptions: {
          info: {
            title: "Orbital API",
            version: "1.0.0",
            description: "Personal Relationship Manager API",
          },
          components: {
            securitySchemes: {
              bearerAuth: {
                type: "http",
                scheme: "bearer",
                bearerFormat: "JWT",
                description:
                  "JWT Authorization header using the Bearer scheme.",
              },
            },
          },
          security: [{ bearerAuth: [] }],
        },
      }),
    ],
    interceptors: [
      onError((error) => {
        // Skip logging errors during tests to reduce console noise
        if (process.env.NODE_ENV !== "test") {
          console.error("oRPC Error:", error);
          if (error instanceof Error && error.cause) {
            console.error(error.cause);
          }
        }
      }),
    ],
  });

  // Mount oRPC handler at /rpc/*
  app.use("/rpc/*", async (c, next) => {
    // In Cloudflare Workers, reload settings from c.env on each request
    if (c.env && Object.keys(c.env).length > 0) {
      loadSettings(c.env as Record<string, unknown>);
    }

    // Convert Headers object to plain object for IncomingHttpHeaders
    const headers: Record<string, string | string[]> = {};
    c.req.raw.headers.forEach((value, key) => {
      headers[key] = value;
    });

    // Bind background work to THIS request's execution context. On Cloudflare
    // Workers c.executionCtx provides waitUntil; on Node/Bun it throws (no ctx),
    // so we fall back to fire-and-forget. Capturing it per-request avoids the
    // module-global clobbering that silently dropped background tasks.
    let ctxWaitUntil: WaitUntil | undefined;
    try {
      ctxWaitUntil = c.executionCtx.waitUntil.bind(c.executionCtx);
    } catch {
      ctxWaitUntil = undefined;
    }
    const waitUntil = createWaitUntil(ctxWaitUntil);

    const { matched, response } = await handler.handle(c.req.raw, {
      prefix: "/rpc",
      context: {
        headers,
        env: c.env,
        waitUntil,
        resolveDb,
      },
    });

    if (matched) {
      return c.newResponse(response.body, response);
    }

    await next();
  });

  return app;
}

// Default app used by the Worker entry, the local dev server, and tests.
// Custom deployments can build their own via createApp().
export default createApp();
