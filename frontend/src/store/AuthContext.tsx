import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { AuthUser } from '../types'
import { authService } from '../services/auth.service'

interface AuthContextType {
  user:       AuthUser | null
  token:      string | null
  isLoading:  boolean
  login:      (token: string, user: AuthUser) => void
  logout:     () => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user,      setUser]      = useState<AuthUser | null>(null)
  const [token,     setToken]     = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const storedToken = localStorage.getItem('token')
    if (storedToken) {
      setToken(storedToken)
      authService
        .getMe()
        .then((u) => setUser(u))
        .catch(() => {
          localStorage.removeItem('token')
          setToken(null)
        })
        .finally(() => setIsLoading(false))
    } else {
      setIsLoading(false)
    }
  }, [])

  const login = (newToken: string, newUser: AuthUser) => {
    localStorage.setItem('token', newToken)
    setToken(newToken)
    setUser(newUser)
  }

  const logout = () => {
    localStorage.removeItem('token')
    setToken(null)
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, token, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
