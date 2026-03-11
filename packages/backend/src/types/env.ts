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
  S3_ENDPOINT?: string;
  S3_ACCESS_KEY_ID?: string;
  S3_SECRET_ACCESS_KEY?: string;
  S3_BUCKET_NAME?: string;
  S3_PUBLIC_URL_PREFIX?: string;
  S3_REGION?: string;
  LLM_BASE_URL?: string;
  LLM_API_KEY?: string;
  LLM_FAST_MODEL?: string;
}
