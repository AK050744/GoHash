import { useState, FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Shield } from 'lucide-react'
import { useAuth, roleDashboard } from '../../context/AuthContext'
import { ApiError } from '../../lib/api'
import Button from '../../components/ui/Button'
import Alert from '../../components/ui/Alert'

export default function RegisterPage() {
  const { register } = useAuth()
  const navigate = useNavigate()

  const [name,     setName]            = useState('')
  const [email,    setEmail]           = useState('')
  const [password, setPassword]        = useState('')
  const [confirm,  setConfirm]         = useState('')
  const [err,      setErr]             = useState('')
  const [loading,  setLoading]         = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setErr('')
    if (password !== confirm) { setErr('Passwords do not match.'); return }
    setLoading(true)
    try {
      const user = await register(name, email, password, confirm)
      navigate(roleDashboard(user.role), { replace: true })
    } catch (ex) {
      setErr(ex instanceof ApiError ? ex.message : 'Registration failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <Shield className="h-10 w-10 text-primary-400 mx-auto mb-3" />
          <h1 className="text-3xl font-extrabold text-white">Create account</h1>
          <p className="text-surface-400 mt-1 text-sm">Start notarizing in minutes</p>
        </div>

        <div className="bg-surface-800 border border-surface-700 rounded-2xl p-8 shadow-xl">
          {err && <Alert type="error">{err}</Alert>}

          <form id="register-form" onSubmit={submit} className="mt-6 space-y-5">
            <div>
              <label htmlFor="register-name" className="block text-sm font-medium text-surface-300 mb-1">Full name</label>
              <input
                id="register-name" type="text" autoComplete="name" required
                value={name} onChange={e => setName(e.target.value)}
                className="w-full bg-surface-900 border border-surface-600 rounded-xl px-4 py-2.5 text-white placeholder-surface-500 focus:outline-none focus:ring-2 focus:ring-primary-500 transition"
                placeholder="Jane Doe"
              />
            </div>

            <div>
              <label htmlFor="register-email" className="block text-sm font-medium text-surface-300 mb-1">Email address</label>
              <input
                id="register-email" type="email" autoComplete="email" required
                value={email} onChange={e => setEmail(e.target.value)}
                className="w-full bg-surface-900 border border-surface-600 rounded-xl px-4 py-2.5 text-white placeholder-surface-500 focus:outline-none focus:ring-2 focus:ring-primary-500 transition"
                placeholder="you@example.com"
              />
            </div>

            <div>
              <label htmlFor="register-password" className="block text-sm font-medium text-surface-300 mb-1">Password</label>
              <input
                id="register-password" type="password" autoComplete="new-password" required minLength={8}
                value={password} onChange={e => setPassword(e.target.value)}
                className="w-full bg-surface-900 border border-surface-600 rounded-xl px-4 py-2.5 text-white placeholder-surface-500 focus:outline-none focus:ring-2 focus:ring-primary-500 transition"
                placeholder="Min 8 characters"
              />
            </div>

            <div>
              <label htmlFor="register-confirm" className="block text-sm font-medium text-surface-300 mb-1">Confirm password</label>
              <input
                id="register-confirm" type="password" autoComplete="new-password" required
                value={confirm} onChange={e => setConfirm(e.target.value)}
                className="w-full bg-surface-900 border border-surface-600 rounded-xl px-4 py-2.5 text-white placeholder-surface-500 focus:outline-none focus:ring-2 focus:ring-primary-500 transition"
                placeholder="Repeat password"
              />
            </div>

            <Button id="register-submit" type="submit" loading={loading} className="w-full">
              Create account
            </Button>
          </form>
        </div>

        <p className="text-center text-sm text-surface-400">
          Already have an account?{' '}
          <Link to="/login" className="text-primary-400 hover:text-primary-300 font-medium">Sign in</Link>
        </p>
      </div>
    </div>
  )
}
