import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

// Zod schema for validation
const envSchema = {
  // Authentication (required)
  JWKS_URL: z.url(),
  JWT_AUDIENCE: z.string().min(1).optional(),
  JWT_ISSUER: z.url().optional(),

  // Database (optional with defaults)
  DB_PROVIDER: z.enum(["sqlite", "d1"]).default("sqlite"),
  SQLITE_DB_PATH: z.string().default("./local.db"),

  // Database Encryption (required for integrations)
  DB_ENCRYPTION_KEY: z.string().optional(), // 32-byte base64url-encoded secret

  // Google OAuth (required for Google Contacts integration)
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),

  // Server (optional with defaults)
  PORT: z.coerce.number().int().positive().default(8787),
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),

  // Testing (optional with defaults)
  DISABLE_JWT_VERIFICATION: z.enum(["true", "false"]).default("false"),
};
const envObject = z.object(envSchema);
// Type for settings
type SettingsType = z.infer<typeof envObject>;

// Create the settings object that will be mutated in place
export const settings: SettingsType = {} as SettingsType;

// Initialize settings from environment
export function loadSettings(
  env: Record<string, any>,
  skipValidation = false,
): void {
  const validated = createEnv({
    server: envSchema,
    runtimeEnv: env,
    skipValidation,
    emptyStringAsUndefined: true,
  });

  // Update settings object in place to maintain references
  for (const key in validated) {
    (settings as any)[key] = validated[key as keyof typeof validated];
  }
}

loadSettings(process.env, !!process.env.SKIP_ENV_VALIDATION);
// Export type for TypeScript
export type Settings = SettingsType;
