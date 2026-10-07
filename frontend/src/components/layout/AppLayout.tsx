import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { Menu } from 'lucide-react'
import Sidebar from './Sidebar'

export function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  return (
    <div className="flex h-screen bg-surface-950 overflow-hidden">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top bar (mobile only) */}
        <header className="lg:hidden h-14 flex items-center gap-3 px-4 border-b border-surface-700 bg-surface-900">
          <button
            onClick={() => setSidebarOpen(true)}
            className="text-surface-400 hover:text-white"
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <span className="font-semibold text-white">GoHash</span>
        </header>

        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
