import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from 'react'
import { api } from '../lib/api'
import type { User, AuthResponse, MeResponse, UserRole } from '../types'

// XSS tradeoff documented in lib/api.ts

interface AuthCtx {
  user: User | null
  token: string | null
  isLoading: boolean
  login: (email: string, password: string) => Promise<User>
  register: (name: string, email: string, password: string, confirmPassword: string) => Promise<User>
  logout: () => void
}

const Ctx = createContext<AuthCtx | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser]         = useState<User | null>(null)
  const [token, setToken]       = useState<string | null>(() => localStorage.getItem('token'))
  const [isLoading, setLoading] = useState(true)

  useEffect(() => {
    const stored = localStorage.getItem('token')
    if (!stored) { setLoading(false); return }
    api.get<MeResponse>('/auth/me')
      .then(r => { setUser(r.user); setToken(stored) })
      .catch(() => { localStorage.removeItem('token'); setToken(null) })
      .finally(() => setLoading(false))
  }, [])

  const persist = (t: string, u: User) => {
    localStorage.setItem('token', t)
    setToken(t)
    setUser(u)
  }

  const login = async (email: string, password: string): Promise<User> => {
    const r = await api.post<AuthResponse>('/auth/login', { email, password })
    persist(r.token, r.user)
    return r.user
  }

  const register = async (
    name: string, email: string, password: string, confirmPassword: string,
  ): Promise<User> => {
    const r = await api.post<AuthResponse>('/auth/register', { name, email, password, confirmPassword })
    persist(r.token, r.user)
    return r.user
  }

  const logout = () => {
    localStorage.removeItem('token')
    setToken(null)
    setUser(null)
  }

  return (
    <Ctx.Provider value={{ user, token, isLoading, login, register, logout }}>
      {children}
    </Ctx.Provider>
  )
}

export function useAuth(): AuthCtx {
  const c = useContext(Ctx)
  if (!c) throw new Error('useAuth must be inside AuthProvider')
  return c
}

export function roleDashboard(role?: UserRole): string {
  if (role === 'ADMIN')  return '/admin/dashboard'
  if (role === 'NOTARY') return '/notary/dashboard'
  return '/dashboard'
}
