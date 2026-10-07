import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import type { UserRole } from '../types'
import Spinner from '../components/ui/Spinner'

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth()
  const location = useLocation()
  if (isLoading) return <div className="min-h-screen grid place-items-center"><Spinner size="lg" /></div>
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />
  return <>{children}</>
}

export function RoleRoute({ children, roles }: { children: React.ReactNode; roles: UserRole[] }) {
  const { user, isLoading } = useAuth()
  const location = useLocation()
  if (isLoading) return <div className="min-h-screen grid place-items-center"><Spinner size="lg" /></div>
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />
  if (!roles.includes(user.role)) return <Navigate to="/unauthorized" replace />
  return <>{children}</>
}
