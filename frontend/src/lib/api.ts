import { API_URL } from './env'

// --- Typed API error ---------------------------------------------------------
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

// --- Core fetch wrapper ------------------------------------------------------
// XSS tradeoff: JWT is stored in localStorage so any injected script can read it.
// httpOnly cookies would remove that risk but require a same-origin or CORS-credentialed
// setup.  For this project (decoupled Vite SPA + Express API) localStorage is acceptable.
type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

export async function request<T = unknown>(
  method: Method,
  path: string,
  body?: unknown,
): Promise<T> {
  const token = localStorage.getItem('token')
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (token) headers['Authorization'] = `Bearer ${token}`

  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })

  // Parse envelope (backend always returns JSON)
  let data: any
  try { data = await res.json() } catch { data = {} }

  if (res.status === 401) {
    localStorage.removeItem('token')
    if (!window.location.pathname.startsWith('/login')) {
      window.location.replace('/login')
    }
  }

  if (!res.ok || data?.success === false) {
    const err = data?.error ?? {}
    throw new ApiError(res.status, err.code ?? 'UNKNOWN', err.message ?? res.statusText)
  }

  return data as T
}

export const api = {
  get:    <T>(path: string)              => request<T>('GET',    path),
  post:   <T>(path: string, body: unknown) => request<T>('POST',   path, body),
  patch:  <T>(path: string, body: unknown) => request<T>('PATCH',  path, body),
  delete: <T>(path: string)              => request<T>('DELETE', path),
}
