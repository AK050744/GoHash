import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Shield, CheckCircle, Menu, X, ArrowRight, UserCircle2 } from 'lucide-react'
import { useAuth, getRoleDashboardPath } from '../../context/AuthContext'
import { Button } from '../ui/Button'

export const Navbar: React.FC = () => {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/80 bg-background/80 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand */}
        <Link to="/" className="flex items-center gap-2.5 group">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-primary to-accent flex items-center justify-center text-dark-900 shadow-glow-primary transition-transform group-hover:scale-105">
            <Shield className="w-5 h-5 text-dark-900 stroke-[2.5]" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-display font-bold text-lg text-white tracking-tight">GoHash</span>
              <span className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded bg-primary/20 text-primary border border-primary/30">
                Notary
              </span>
            </div>
            <p className="text-[10px] text-dark-400 tracking-wide font-medium">Digital Notary Platform</p>
          </div>
        </Link>

        {/* Desktop Navigation Links */}
        <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-dark-300">
          <a href="#how-it-works" className="hover:text-white transition-colors">
            How It Works
          </a>
          <a href="#why-blockchain" className="hover:text-white transition-colors">
            Security & Blockchain
          </a>
          <Link to="/verify" className="hover:text-white flex items-center gap-1.5 transition-colors">
            <CheckCircle className="w-4 h-4 text-accent" />
            Verify Document
          </Link>
        </nav>

        {/* Desktop Auth CTA */}
        <div className="hidden md:flex items-center gap-3">
          {user ? (
            <div className="flex items-center gap-3">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => navigate(getRoleDashboardPath(user.role))}
                leftIcon={<UserCircle2 className="w-4 h-4 text-primary" />}
              >
                {user.name} ({user.role})
              </Button>
              <Button variant="ghost" size="sm" onClick={logout}>
                Log out
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2.5">
              <Button variant="ghost" size="sm" onClick={() => navigate('/login')}>
                Sign In
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={() => navigate('/register')}
                rightIcon={<ArrowRight className="w-3.5 h-3.5" />}
              >
                Get Started
              </Button>
            </div>
          )}
        </div>

        {/* Mobile Menu Button */}
        <div className="flex md:hidden">
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 text-dark-300 hover:text-white rounded-lg focus:outline-none"
            aria-label="Toggle navigation menu"
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden border-b border-border bg-surface px-4 pt-3 pb-5 space-y-3">
          <a
            href="#how-it-works"
            onClick={() => setMobileMenuOpen(false)}
            className="block py-2 text-sm text-dark-200 hover:text-white"
          >
            How It Works
          </a>
          <a
            href="#why-blockchain"
            onClick={() => setMobileMenuOpen(false)}
            className="block py-2 text-sm text-dark-200 hover:text-white"
          >
            Security & Blockchain
          </a>
          <Link
            to="/verify"
            onClick={() => setMobileMenuOpen(false)}
            className="block py-2 text-sm text-dark-200 hover:text-white"
          >
            Verify Document
          </Link>
          <div className="pt-3 border-t border-border flex flex-col gap-2">
            {user ? (
              <>
                <Button
                  variant="secondary"
                  size="sm"
                  className="w-full justify-center"
                  onClick={() => {
                    setMobileMenuOpen(false)
                    navigate(getRoleDashboardPath(user.role))
                  }}
                >
                  Dashboard ({user.role})
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-center"
                  onClick={() => {
                    setMobileMenuOpen(false)
                    logout()
                  }}
                >
                  Log out
                </Button>
              </>
            ) : (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full justify-center"
                  onClick={() => {
                    setMobileMenuOpen(false)
                    navigate('/login')
                  }}
                >
                  Sign In
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  className="w-full justify-center"
                  onClick={() => {
                    setMobileMenuOpen(false)
                    navigate('/register')
                  }}
                >
                  Register
                </Button>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  )
}

export default Navbar
