import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { User, UserRole, AuthResponse, UserResponse } from '../types'
import { api } from '../lib/api'

interface AuthContextType {
  user: User | null
  token: string | null
  loadingUser: boolean
  login: (credentials: { email: string; password: string }) => Promise<User>
  register: (payload: { name: string; email: string; password: string; confirmPassword: string }) => Promise<User>
  logout: () => void
  refreshUser: () => Promise<User | null>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [token, setToken] = useState<string | null>(() => {
    // Note on security tradeoff:
    // Storing JWT in localStorage simplifies client-side state across browser refreshes for SPAs,
    // but makes the token readable by JavaScript (potential exposure to cross-site scripting/XSS).
    // In high-security enterprise deployments, httpOnly SameSite cookies with CSRF defense are preferred.
    // For this decoupled React + REST architecture, localStorage with strict input sanitization is used.
    return localStorage.getItem('token')
  })
  const [loadingUser, setLoadingUser] = useState<boolean>(true)

  // Hydrate user session on initial application mount if token exists
  useEffect(() => {
    const initializeAuth = async () => {
      const storedToken = localStorage.getItem('token')
      if (!storedToken) {
        setLoadingUser(false)
        return
      }

      try {
        const response = await api.get<UserResponse>('/auth/me')
        if (response && response.user) {
          setUser(response.user)
          setToken(storedToken)
        } else {
          throw new Error('Malformed user payload')
        }
      } catch (err) {
        console.warn('Session restoration failed or token expired:', err)
        localStorage.removeItem('token')
        setToken(null)
        setUser(null)
      } finally {
        setLoadingUser(false)
      }
    }

    initializeAuth()
  }, [])

  const login = async (credentials: { email: string; password: string }): Promise<User> => {
    const response = await api.post<AuthResponse>('/auth/login', credentials)
    const { token: receivedToken, user: receivedUser } = response

    localStorage.setItem('token', receivedToken)
    setToken(receivedToken)
    setUser(receivedUser)

    return receivedUser
  }

  const register = async (payload: {
    name: string
    email: string
    password: string
    confirmPassword: string
  }): Promise<User> => {
    const response = await api.post<AuthResponse>('/auth/register', payload)
    const { token: receivedToken, user: receivedUser } = response

    localStorage.setItem('token', receivedToken)
    setToken(receivedToken)
    setUser(receivedUser)

    return receivedUser
  }

  const logout = () => {
    localStorage.removeItem('token')
    setToken(null)
    setUser(null)
  }

  const refreshUser = async (): Promise<User | null> => {
    try {
      const response = await api.get<UserResponse>('/auth/me')
      if (response?.user) {
        setUser(response.user)
        return response.user
      }
      return null
    } catch {
      return null
    }
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loadingUser,
        login,
        register,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an <AuthProvider>')
  }
  return context
}

/**
 * Helper to determine default landing dashboard route based on user role
 */
export function getRoleDashboardPath(role?: UserRole): string {
  switch (role) {
    case 'ADMIN':
      return '/admin/dashboard'
    case 'NOTARY':
      return '/notary/dashboard'
    case 'USER':
    default:
      return '/dashboard'
  }
}
