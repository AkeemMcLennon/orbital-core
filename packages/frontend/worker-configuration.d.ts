// Type definitions for Cloudflare Workers environment
type Env = {
  BACKEND_URL?: string
  ENVIRONMENT?: 'development' | 'staging' | 'production'
}

type HonoENV = {
  Bindings: Env
}

declare global {
  namespace NodeJS {
    interface ProcessEnv {
      BACKEND_URL?: string
    }
  }
}
