export interface Env {
  // Cloudflare D1 binding
  DB: D1Database;

  // BetterAuth
  BETTER_AUTH_SECRET: string;
  BETTER_AUTH_URL: string;

  // Google OAuth (optional)
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;

  // Apple Sign-In (optional)
  APPLE_CLIENT_ID?: string;
  APPLE_TEAM_ID?: string;
  APPLE_KEY_ID?: string;
  APPLE_PRIVATE_KEY?: string;
  APPLE_APP_BUNDLE_IDENTIFIER?: string;
}
