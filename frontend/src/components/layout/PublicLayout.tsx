import { Outlet } from 'react-router-dom'
import Navbar from './Navbar'

export function PublicLayout() {
  return (
    <div className="min-h-screen bg-surface-950 flex flex-col">
      <Navbar />
      <main className="flex-1">
        <Outlet />
      </main>
      <footer className="border-t border-surface-800 py-6 text-center text-sm text-surface-500">
        © {new Date().getFullYear()} GoHash · Blockchain-Based Digital Notary
      </footer>
    </div>
  )
}
