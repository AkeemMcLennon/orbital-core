const TOKEN_KEY = 'orbital_auth_token'
const USER_KEY = 'orbital_user'

export function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(TOKEN_KEY)
}

export function setAuthToken(token: string): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(TOKEN_KEY, token)
}

export function removeAuthToken(): void {
  if (typeof window === 'undefined') return
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(USER_KEY)
}

export function getStoredUser(): any {
  if (typeof window === 'undefined') return null
  const userData = localStorage.getItem(USER_KEY)
  return userData ? JSON.parse(userData) : null
}

export function setStoredUser(user: any): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(USER_KEY, JSON.stringify(user))
}
