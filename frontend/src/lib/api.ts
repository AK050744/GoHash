import { ApiError, ApiErrorEnvelope } from '../types'

const BASE_URL = (
  import.meta.env.VITE_API_URL ||
  import.meta.env.VITE_API_BASE_URL ||
  'http://localhost:5000/api'
).replace(/\/$/, '')

interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown
}

export async function request<T = any>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  const url = endpoint.startsWith('http') ? endpoint : `${BASE_URL}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`

  const token = localStorage.getItem('token')

  const headers = new Headers(options.headers || {})
  if (token) {
    headers.set('Authorization', `Bearer ${token}`)
  }

  const isJson = options.body && !(options.body instanceof FormData)
  if (isJson) {
    headers.set('Content-Type', 'application/json')
  }

  const config: RequestInit = {
    ...options,
    headers,
    body: isJson ? JSON.stringify(options.body) : (options.body as BodyInit),
  }

  let response: Response
  try {
    response = await fetch(url, config)
  } catch (networkError: any) {
    throw new ApiError(0, {
      code: 'NETWORK_ERROR',
      message: networkError.message || 'Network request failed. Is the backend server running?',
    })
  }

  let data: any
  try {
    data = await response.json()
  } catch {
    data = null
  }

  // Handle HTTP 401 Unauthorized globally
  if (response.status === 401) {
    localStorage.removeItem('token')
    if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
      window.location.href = '/login'
    }
  }

  // Handle error envelope
  if (!response.ok || (data && data.success === false)) {
    const errorDetail = (data as ApiErrorEnvelope)?.error || {
      code: `HTTP_${response.status}`,
      message: response.statusText || 'An unexpected error occurred',
    }
    throw new ApiError(response.status, errorDetail)
  }

  return data as T
}

export const api = {
  get: <T = any>(endpoint: string, options?: RequestOptions) => request<T>(endpoint, { ...options, method: 'GET' }),
  post: <T = any>(endpoint: string, body?: unknown, options?: RequestOptions) =>
    request<T>(endpoint, { ...options, method: 'POST', body }),
  put: <T = any>(endpoint: string, body?: unknown, options?: RequestOptions) =>
    request<T>(endpoint, { ...options, method: 'PUT', body }),
  patch: <T = any>(endpoint: string, body?: unknown, options?: RequestOptions) =>
    request<T>(endpoint, { ...options, method: 'PATCH', body }),
  delete: <T = any>(endpoint: string, options?: RequestOptions) =>
    request<T>(endpoint, { ...options, method: 'DELETE' }),
}

export default api
