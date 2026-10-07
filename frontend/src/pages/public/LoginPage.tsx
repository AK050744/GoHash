import React, { useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { Shield, Mail, Lock, ArrowRight } from 'lucide-react'
import { useAuth, getRoleDashboardPath } from '../../context/AuthContext'
import { Button } from '../../components/ui/Button'
import { Alert } from '../../components/ui/Alert'
import { Card } from '../../components/ui/Card'

export const LoginPage: React.FC = () => {
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMessage(null)

    if (!email || !password) {
      setErrorMessage('Please provide both your email address and password.')
      return
    }

    try {
      setLoading(true)
      const authenticatedUser = await login({ email, password })

      // Determine redirect location: if redirected from a protected route, or default role dashboard
      const fromPath = (location.state as any)?.from?.pathname
      const targetPath = fromPath || getRoleDashboardPath(authenticatedUser.role)
      navigate(targetPath, { replace: true })
    } catch (err: any) {
      setErrorMessage(err.message || 'Invalid email or password.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background flex flex-col justify-center py-12 sm:px-6 lg:px-8 bg-grid-pattern relative">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[300px] bg-primary/15 blur-[120px] rounded-full pointer-events-none" />

      {/* Header */}
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center z-10">
        <Link to="/" className="inline-flex items-center gap-2.5 group mb-4">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-primary to-accent flex items-center justify-center text-dark-900 shadow-glow-primary transition-transform group-hover:scale-105">
            <Shield className="w-5 h-5 text-dark-900 stroke-[2.5]" />
          </div>
          <span className="font-display font-bold text-2xl text-white tracking-tight">GoHash</span>
        </Link>
        <h2 className="text-2xl font-bold text-white tracking-tight font-display">Welcome Back</h2>
        <p className="mt-1.5 text-sm text-dark-400">
          Sign in to manage and notarize digital documents
        </p>
      </div>

      {/* Form Card */}
      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md z-10 px-4 sm:px-0">
        <Card className="p-8 bg-surface/90 backdrop-blur-xl border-border">
          {errorMessage && (
            <Alert
              type="error"
              message={errorMessage}
              onClose={() => setErrorMessage(null)}
              className="mb-6"
            />
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Email Field */}
            <div>
              <label className="block text-xs font-semibold text-dark-300 uppercase tracking-wider mb-2">
                Email Address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-dark-400">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="notary@example.com"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-surface-secondary border border-border text-white text-sm placeholder-dark-500 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors"
                />
              </div>
            </div>

            {/* Password Field */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-xs font-semibold text-dark-300 uppercase tracking-wider">
                  Password
                </label>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-dark-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type="password"
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-surface-secondary border border-border text-white text-sm placeholder-dark-500 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors"
                />
              </div>
            </div>

            {/* Submit Button */}
            <Button
              type="submit"
              variant="primary"
              size="lg"
              isLoading={loading}
              className="w-full mt-2"
              rightIcon={<ArrowRight className="w-4 h-4" />}
            >
              Sign In
            </Button>
          </form>

          {/* Quick Demo Credentials helper */}
          <div className="mt-6 pt-5 border-t border-border/80 text-xs text-dark-400 text-center">
            <p className="font-semibold text-dark-300 mb-1">Pre-Seeded Roles available:</p>
            <p className="font-mono text-[11px] text-dark-400">admin@gohash.io &middot; AdminPassword123!</p>
            <p className="font-mono text-[11px] text-dark-400">notary@gohash.io &middot; NotaryPassword123!</p>
          </div>
        </Card>

        {/* Footer Link */}
        <p className="text-center text-sm text-dark-400 mt-6">
          Don&apos;t have an account?{' '}
          <Link to="/register" className="text-primary hover:text-primary-light font-medium">
            Create account
          </Link>
        </p>
      </div>
    </div>
  )
}

export default LoginPage
