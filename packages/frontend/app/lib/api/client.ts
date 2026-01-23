import { createORPCClient } from '@orpc/client'
import type { router } from '@orbital/backend/routes'
import { customFetch } from './custom-fetch'

const getBackendUrl = () => {
  if (typeof window !== 'undefined') {
    // Client-side
    return window.ENV?.BACKEND_URL || 'http://localhost:8787'
  }
  // Server-side
  return process.env.BACKEND_URL || 'http://localhost:8787'
}

export const api = createORPCClient<typeof router>({
  baseURL: `${getBackendUrl()}/rpc`,
  fetch: customFetch,
})

// Named exports for convenience
export const contacts = api.contacts
export const auth = api.auth
