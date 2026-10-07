import React from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { UserRole } from '../types'
import { Spinner } from '../components/ui/Spinner'

interface RoleRouteProps {
  allowedRoles: UserRole[]
  children: React.ReactNode
}

export const RoleRoute: React.FC<RoleRouteProps> = ({ allowedRoles, children }) => {
  const { user, loadingUser } = useAuth()
  const location = useLocation()

  if (loadingUser) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4">
        <Spinner size="lg" />
        <p className="text-sm text-dark-300 font-medium">Authorizing role permissions...</p>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  if (!allowedRoles.includes(user.role)) {
    return <Navigate to="/unauthorized" state={{ from: location }} replace />
  }

  return <>{children}</>
}

export default RoleRoute
