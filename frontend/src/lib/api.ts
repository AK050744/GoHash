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
  interface Envelope {
    success?: boolean
    error?: { code?: string; message?: string }
  }
  let data: (T & Envelope) | null = null
  try { data = (await res.json()) as T & Envelope } catch { data = null }

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
  get:     <T>(path: string)                 => request<T>('GET',    path),
  post:    <T>(path: string, body?: unknown) => request<T>('POST',   path, body),
  patch:   <T>(path: string, body?: unknown) => request<T>('PATCH',  path, body),
  delete:  <T>(path: string)                 => request<T>('DELETE', path),
  upload:  <T>(file: File, onProgress?: (percent: number) => void, path?: string) => upload<T>(file, onProgress, path),
  getBlob: (path: string)                    => getBlob(path),
}

// --- File upload wrapper using XMLHttpRequest for progress tracking ----------
export function upload<T = unknown>(
  file: File,
  onProgress?: (percent: number) => void,
  path = '/documents/upload',
): Promise<T> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', `${API_URL}${path}`)

    const token = localStorage.getItem('token')
    if (token) {
      xhr.setRequestHeader('Authorization', `Bearer ${token}`)
    }
    // Do NOT set Content-Type header manually for multipart.
    // The browser sets multipart/form-data with the correct boundary automatically.

    if (xhr.upload && onProgress) {
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable && event.total > 0) {
          const percent = Math.round((event.loaded / event.total) * 100)
          onProgress(percent)
        }
      }
    }

    xhr.onload = () => {
      interface Envelope {
        success?: boolean
        error?: { code?: string; message?: string }
      }
      let data: (T & Envelope) | null = null
      try {
        data = JSON.parse(xhr.responseText) as T & Envelope
      } catch {
        data = null
      }

      if (xhr.status === 401) {
        localStorage.removeItem('token')
        if (!window.location.pathname.startsWith('/login')) {
          window.location.replace('/login')
        }
      }

      if (xhr.status >= 200 && xhr.status < 300 && data?.success !== false) {
        resolve(data as T)
      } else {
        const err = data?.error ?? {}
        reject(new ApiError(xhr.status, err.code ?? 'UNKNOWN', err.message ?? xhr.statusText))
      }
    }

    xhr.onerror = () => {
      reject(new ApiError(0, 'NETWORK_ERROR', 'Network connection error during file upload'))
    }

    xhr.ontimeout = () => {
      reject(new ApiError(0, 'TIMEOUT_ERROR', 'File upload timed out'))
    }

    const formData = new FormData()
    formData.append('file', file)
    xhr.send(formData)
  })
}

// --- Authenticated binary fetch wrapper (for streaming PDFs) -----------------
export async function getBlob(path: string): Promise<Blob> {
  const token = localStorage.getItem('token')
  const headers: Record<string, string> = {}
  if (token) headers['Authorization'] = `Bearer ${token}`

  const res = await fetch(`${API_URL}${path}`, {
    method: 'GET',
    headers,
  })

  if (res.status === 401) {
    localStorage.removeItem('token')
    if (!window.location.pathname.startsWith('/login')) {
      window.location.replace('/login')
    }
  }

  if (!res.ok) {
    let code = 'UNKNOWN'
    let message = res.statusText
    try {
      const json = await res.json()
      if (json?.error) {
        code = json.error.code ?? code
        message = json.error.message ?? message
      }
    } catch {
      // Body is not JSON
    }
    throw new ApiError(res.status, code, message)
  }

  return res.blob()
}
