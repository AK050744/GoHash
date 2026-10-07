import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Shield, Menu, X, LogOut, Wallet, UserCircle2 } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { Sidebar } from './Sidebar'
import { Button } from '../ui/Button'

export const DashboardLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <div className="min-h-screen bg-background flex flex-col text-dark-100">
      {/* Top Header */}
      <header className="sticky top-0 z-30 h-16 border-b border-border bg-surface/80 backdrop-blur-md px-4 sm:px-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {/* Mobile Sidebar Toggle Button */}
          <button
            onClick={() => setMobileSidebarOpen(true)}
            className="md:hidden p-2 text-dark-300 hover:text-white rounded-lg focus:outline-none"
            aria-label="Open sidebar"
          >
            <Menu className="w-5 h-5" />
          </button>

          {/* Logo */}
          <Link to="/" className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-primary to-accent flex items-center justify-center text-dark-900 shadow-glow-primary">
              <Shield className="w-4 h-4 text-dark-900 stroke-[2.5]" />
            </div>
            <span className="font-display font-bold text-base text-white tracking-tight hidden sm:inline-block">
              GoHash
            </span>
          </Link>
        </div>

        {/* User Status & Actions */}
        <div className="flex items-center gap-3 sm:gap-4">
          {/* Wallet Status Badge */}
          {user?.walletAddress ? (
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-surface-secondary border border-border text-xs font-mono text-dark-200">
              <Wallet className="w-3.5 h-3.5 text-accent" />
              <span>
                {user.walletAddress.substring(0, 6)}...{user.walletAddress.substring(38)}
              </span>
            </div>
          ) : (
            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-dark-800 text-[11px] text-dark-400 border border-border/50">
              <Wallet className="w-3 h-3 text-dark-500" />
              <span>Wallet unlinked</span>
            </div>
          )}

          {/* User Profile Pill */}
          <div className="flex items-center gap-2.5 pl-2 sm:pl-3 border-l border-border">
            <div className="w-8 h-8 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center text-primary font-semibold text-xs">
              {user?.name ? user.name.charAt(0).toUpperCase() : <UserCircle2 className="w-4 h-4" />}
            </div>
            <div className="hidden md:block text-left">
              <p className="text-xs font-semibold text-white leading-tight">{user?.name}</p>
              <span className="text-[10px] font-medium text-dark-400 capitalize">{user?.role}</span>
            </div>
          </div>

          {/* Logout Button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleLogout}
            leftIcon={<LogOut className="w-4 h-4 text-dark-400" />}
            className="text-dark-300 hover:text-rose-400"
          >
            <span className="hidden sm:inline">Sign out</span>
          </Button>
        </div>
      </header>

      {/* Main Body */}
      <div className="flex-1 flex overflow-hidden">
        {/* Desktop Sidebar */}
        <div className="hidden md:block shrink-0">
          <Sidebar />
        </div>

        {/* Mobile Slide-Over Drawer */}
        {mobileSidebarOpen && (
          <div className="fixed inset-0 z-50 md:hidden flex">
            {/* Backdrop */}
            <div
              className="fixed inset-0 bg-black/70 backdrop-blur-sm transition-opacity"
              onClick={() => setMobileSidebarOpen(false)}
            />
            {/* Drawer */}
            <div className="relative flex-1 flex flex-col max-w-xs w-full bg-surface shadow-2xl">
              <div className="absolute top-3 right-3">
                <button
                  onClick={() => setMobileSidebarOpen(false)}
                  className="p-1.5 text-dark-300 hover:text-white rounded-lg focus:outline-none"
                  aria-label="Close sidebar"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <Sidebar onCloseMobile={() => setMobileSidebarOpen(false)} />
            </div>
          </div>
        )}

        {/* Dynamic Content Area */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 bg-background">
          <div className="max-w-6xl mx-auto">{children}</div>
        </main>
      </div>
    </div>
  )
}

export default DashboardLayout
