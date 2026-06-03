// Client-side helpers for the developer portal (runs in the browser).
export const API_BASE = import.meta.env.PUBLIC_API_BASE || 'http://127.0.0.1:8787'
const TOKEN_KEY = 'omrp_dev_token'

export const getToken = (): string | null => localStorage.getItem(TOKEN_KEY)
export const setToken = (t: string): void => localStorage.setItem(TOKEN_KEY, t)
export const clearToken = (): void => localStorage.removeItem(TOKEN_KEY)

/** Fetch the backend with JSON + the developer Bearer token (if any). */
export async function api(path: string, init: RequestInit = {}): Promise<Response> {
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    ...((init.headers as Record<string, string>) ?? {}),
  }
  const token = getToken()
  if (token) headers.Authorization = `Bearer ${token}`
  return fetch(`${API_BASE}${path}`, { ...init, headers })
}

const ESCAPES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }
export const esc = (s: string): string => String(s).replace(/[&<>"]/g, (c) => ESCAPES[c])

// ── Super-admin (shared X-Admin-Key, kept in sessionStorage) ─────────────────
const ADMIN_KEY = 'omrp_admin_key'
export const getAdminKey = (): string | null => sessionStorage.getItem(ADMIN_KEY)
export const setAdminKey = (k: string): void => sessionStorage.setItem(ADMIN_KEY, k)
export const clearAdminKey = (): void => sessionStorage.removeItem(ADMIN_KEY)

/** Fetch an admin endpoint with the X-Admin-Key header (supports GET + mutations). */
export async function adminApi(path: string, init: RequestInit = {}): Promise<Response> {
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    'X-Admin-Key': getAdminKey() ?? '',
    ...((init.headers as Record<string, string>) ?? {}),
  }
  return fetch(`${API_BASE}${path}`, { ...init, headers })
}
