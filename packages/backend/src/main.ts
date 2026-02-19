#!/usr/bin/env bun
/**
 * Local development server using Bun
 *
 * Alternative to wrangler dev for local-only testing with SQLite
 * For Cloudflare Workers development, use: bun run dev (wrangler dev)
 */
import { settings } from "./config";
import { startServer } from "./server";

console.log("Starting Orbital API server...");
console.log(`Environment: ${settings.NODE_ENV}`);

const server = await startServer({
  port: settings.PORT,
  hostname: "0.0.0.0",
});

console.log(`\n✓ Server running at ${server.url}`);
console.log(`  - Health: ${server.url}/health`);
console.log(`  - API Docs: ${server.url}/rpc`);
console.log("\nPress Ctrl+C to stop\n");

// Graceful shutdown
process.on("SIGINT", () => {
  console.log("\n\nShutting down server...");
  server.stop();
  process.exit(0);
});

process.on("SIGTERM", () => {
  console.log("\n\nShutting down server...");
  server.stop();
  process.exit(0);
});
