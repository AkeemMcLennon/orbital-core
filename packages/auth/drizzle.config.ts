import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/database/schema/index.ts",
  out: "./src/database/migrations",
  dialect: "sqlite",
});
