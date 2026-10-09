import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { Menu } from 'lucide-react'
import Sidebar from './Sidebar'
import WalletButton from '../wallet/WalletButton'

export function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  return (
    <div className="flex h-screen bg-surface-950 overflow-hidden">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Navbar */}
        <header className="h-16 flex items-center justify-between px-4 sm:px-6 border-b border-surface-700 bg-surface-900/80 backdrop-blur z-20 flex-shrink-0">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden text-surface-400 hover:text-white p-1 rounded-lg hover:bg-surface-800 transition"
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" />
            </button>
            <span className="lg:hidden font-bold text-white text-base tracking-tight">GoHash</span>
          </div>

          <div className="flex items-center gap-3">
            <WalletButton />
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 sm:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
