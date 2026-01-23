import { getAuthToken } from '../auth/session'

export async function customFetch<T>(
  url: string,
  options?: RequestInit
): Promise<T> {
  const token = getAuthToken()
  const headers = new Headers(options?.headers)

  if (token) {
    headers.set('Authorization', `Bearer ${token}`)
  }

  headers.set('Content-Type', 'application/json')

  const response = await fetch(url, {
    ...options,
    headers,
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({}))
    throw new Error(error.message || `HTTP ${response.status}`)
  }

  return response.json()
}
