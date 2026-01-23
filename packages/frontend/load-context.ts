import type { Context } from 'hono'
import type { AppLoadContext } from 'react-router'
import type { PlatformProxy } from 'wrangler'

type Cloudflare = Omit<PlatformProxy, 'dispose' | 'env'> & { env: Env }

declare module 'react-router' {
  interface AppLoadContext {
    cloudflare: Cloudflare
    hono: {
      context: Context<HonoENV>
    }
    backendUrl: string
  }
}

type GetLoadContext = (args: {
  request: Request
  context: {
    cloudflare: Cloudflare
    hono: { context: Context<HonoENV> }
  }
}) => AppLoadContext

export const getLoadContext: GetLoadContext = ({ context }) => {
  const backendUrl = context.cloudflare.env.BACKEND_URL || 'http://localhost:8787'

  return {
    ...context,
    backendUrl,
  }
}
