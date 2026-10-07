// Read VITE_API_URL at runtime (Vite replaces import.meta.env at build time)
export const API_URL: string =
  (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:5000/api'
