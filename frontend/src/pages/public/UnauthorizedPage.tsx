import React from 'react'
import { useNavigate } from 'react-router-dom'
import { ShieldAlert, ArrowLeft, Home } from 'lucide-react'
import { useAuth, getRoleDashboardPath } from '../../context/AuthContext'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'

export const UnauthorizedPage: React.FC = () => {
  const { user } = useAuth()
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 bg-grid-pattern relative">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[450px] h-[300px] bg-rose-500/10 blur-[130px] rounded-full pointer-events-none" />

      <Card className="max-w-md w-full text-center p-8 bg-surface/90 backdrop-blur-xl border-border z-10">
        <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center mx-auto mb-5 shadow-lg">
          <ShieldAlert className="w-8 h-8" />
        </div>

        <span className="px-2.5 py-1 rounded-full text-xs font-mono font-semibold bg-rose-500/10 text-rose-300 border border-rose-500/20">
          HTTP 403 FORBIDDEN
        </span>

        <h1 className="text-2xl font-bold text-white tracking-tight mt-4 font-display">
          Access Restricted
        </h1>

        <p className="text-sm text-dark-300 mt-2 leading-relaxed">
          Your current account role (
          <span className="font-semibold text-white uppercase">{user?.role || 'ANONYMOUS'}</span>
          ) does not have authorization to view this protected workspace.
        </p>

        <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
          <Button
            variant="secondary"
            onClick={() => navigate(-1)}
            leftIcon={<ArrowLeft className="w-4 h-4" />}
          >
            Go Back
          </Button>
          <Button
            variant="primary"
            onClick={() => navigate(getRoleDashboardPath(user?.role))}
            leftIcon={<Home className="w-4 h-4" />}
          >
            Return to Dashboard
          </Button>
        </div>
      </Card>
    </div>
  )
}

export default UnauthorizedPage
