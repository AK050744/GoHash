import { useState, FormEvent } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { Shield } from 'lucide-react'
import { useAuth, roleDashboard } from '../../context/AuthContext'
import { ApiError } from '../../lib/api'
import Button from '../../components/ui/Button'
import Alert from '../../components/ui/Alert'

export default function LoginPage() {
  const { login } = useAuth()
  const navigate   = useNavigate()
  const location   = useLocation()
  const from       = (location.state as { from?: { pathname: string } })?.from?.pathname

  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [err,      setErr]      = useState('')
  const [loading,  setLoading]  = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setErr('')
    setLoading(true)
    try {
      const user = await login(email, password)
      navigate(from ?? roleDashboard(user.role), { replace: true })
    } catch (ex) {
      setErr(ex instanceof ApiError ? ex.message : 'Login failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md space-y-8">
        {/* Brand */}
        <div className="text-center">
          <Shield className="h-10 w-10 text-primary-400 mx-auto mb-3" />
          <h1 className="text-3xl font-extrabold text-white">Welcome back</h1>
          <p className="text-surface-400 mt-1 text-sm">Sign in to your GoHash account</p>
        </div>

        <div className="bg-surface-800 border border-surface-700 rounded-2xl p-8 shadow-xl">
          {err && <Alert type="error" >{err}</Alert>}

          <form id="login-form" onSubmit={submit} className="mt-6 space-y-5">
            <div>
              <label htmlFor="login-email" className="block text-sm font-medium text-surface-300 mb-1">
                Email address
              </label>
              <input
                id="login-email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full bg-surface-900 border border-surface-600 rounded-xl px-4 py-2.5 text-white placeholder-surface-500 focus:outline-none focus:ring-2 focus:ring-primary-500 transition"
                placeholder="you@example.com"
              />
            </div>

            <div>
              <label htmlFor="login-password" className="block text-sm font-medium text-surface-300 mb-1">
                Password
              </label>
              <input
                id="login-password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full bg-surface-900 border border-surface-600 rounded-xl px-4 py-2.5 text-white placeholder-surface-500 focus:outline-none focus:ring-2 focus:ring-primary-500 transition"
                placeholder="••••••••"
              />
            </div>

            <Button id="login-submit" type="submit" loading={loading} className="w-full">
              Sign in
            </Button>
          </form>
        </div>

        <p className="text-center text-sm text-surface-400">
          Don't have an account?{' '}
          <Link to="/register" className="text-primary-400 hover:text-primary-300 font-medium">
            Create one
          </Link>
        </p>
      </div>
    </div>
  )
}
