// Cloudflare Workers environment types
// Note: In Workers, these will be secrets and bindings
// Settings module will handle JWKS_URL, JWT_AUDIENCE, JWT_ISSUER via loadSettings()
export interface Env {
  DB?: D1Database;
  JWKS_URL?: string;
  JWT_AUDIENCE?: string;
  JWT_ISSUER?: string;
  DB_PROVIDER?: string;
  SQLITE_DB_PATH?: string;
  DISABLE_JWT_VERIFICATION?: string;
}
