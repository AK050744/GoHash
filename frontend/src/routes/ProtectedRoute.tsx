import React from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Spinner } from '../components/ui/Spinner'

export const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loadingUser } = useAuth()
  const location = useLocation()

  if (loadingUser) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4">
        <Spinner size="lg" />
        <p className="text-sm text-dark-300 font-medium">Validating cryptographic credentials...</p>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  return <>{children}</>
}

export default ProtectedRoute
