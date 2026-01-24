import { OpenAPIHandler } from "@orpc/openapi/fetch";
import { OpenAPIReferencePlugin } from "@orpc/openapi/plugins";
import { onError } from "@orpc/server";
import { CORSPlugin } from "@orpc/server/plugins";
import { ZodToJsonSchemaConverter } from "@orpc/zod/zod4";
import { Hono } from "hono";
import { logger } from "hono/logger";
import { loadSettings } from "./config";
import router from "./routes";

// Cloudflare Workers environment types
// Note: In Workers, these will be secrets and bindings
// Settings module will handle JWKS_URL, JWT_AUDIENCE, JWT_ISSUER via loadSettings()
interface Env {
  DB?: D1Database;
  JWKS_URL?: string;
  JWT_AUDIENCE?: string;
  JWT_ISSUER?: string;
  DB_PROVIDER?: string;
  SQLITE_DB_PATH?: string;
  DISABLE_JWT_VERIFICATION?: string;
}

const app = new Hono<{ Bindings: Env }>();

// Apply logger middleware
app.use("*", logger());

// Health check endpoint
app.get("/health", (c) => {
  return c.json({ status: "ok", timestamp: new Date().toISOString() });
});

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
              description: "JWT Authorization header using the Bearer scheme.",
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
      if (process.env.NODE_ENV !== 'test') {
        console.error("oRPC Error:", error);
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

  const { matched, response } = await handler.handle(c.req.raw, {
    prefix: "/rpc",
    context: {
      headers,
      env: c.env,
    },
  });

  if (matched) {
    return c.newResponse(response.body, response);
  }

  await next();
});

export default app;
