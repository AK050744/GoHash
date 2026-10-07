import { Link, useNavigate } from 'react-router-dom'
import { Shield } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { roleDashboard } from '../../context/AuthContext'
import Button from '../ui/Button'

export default function Navbar() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = () => { logout(); navigate('/') }

  return (
    <header className="sticky top-0 z-40 bg-surface-900/80 backdrop-blur border-b border-surface-700">
      <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2 font-bold text-xl text-white">
          <Shield className="h-6 w-6 text-primary-400" />
          <span>GoHash</span>
        </Link>

        <div className="flex items-center gap-3">
          {user ? (
            <>
              <Link
                to={roleDashboard(user.role)}
                className="text-sm text-surface-300 hover:text-white transition"
              >
                Dashboard
              </Link>
              <Button variant="ghost" size="sm" onClick={handleLogout}>
                Log out
              </Button>
            </>
          ) : (
            <>
              <Link to="/login">
                <Button variant="ghost" size="sm">Log in</Button>
              </Link>
              <Link to="/register">
                <Button size="sm">Get started</Button>
              </Link>
            </>
          )}
        </div>
      </nav>
    </header>
  )
}
