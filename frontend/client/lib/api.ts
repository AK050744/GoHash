/**
 * api.ts – centralised HTTP client for the GoHash backend.
 *
 * All requests go to VITE_API_URL (default: http://localhost:5000/api).
 * The JWT token is stored in localStorage under the key "gohash_token".
 * Every helper returns the full JSON body on success and throws an Error
 * with `message` taken from the backend error envelope on failure.
 */

const BASE = import.meta.env.VITE_API_URL ?? "http://localhost:5000/api";

export const TOKEN_KEY = "gohash_token";

function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function saveToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  isFormData = false,
): Promise<T> {
  const token = getToken();

  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;
  if (!isFormData && body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: isFormData
      ? (body as FormData)
      : body !== undefined
        ? JSON.stringify(body)
        : undefined,
  });

  const json = await res.json().catch(() => ({}));

  if (!res.ok) {
    const msg =
      json?.error?.message ??
      json?.message ??
      `Request failed: ${res.status}`;
    throw Object.assign(new Error(msg), { code: json?.error?.code, status: res.status });
  }

  return json as T;
}

/* ─── helpers ─── */
export const api = {
  get: <T>(path: string) => request<T>("GET", path),
  post: <T>(path: string, body?: unknown) => request<T>("POST", path, body),
  patch: <T>(path: string, body?: unknown) => request<T>("PATCH", path, body),
  postForm: <T>(path: string, form: FormData) =>
    request<T>("POST", path, form, true),
};
