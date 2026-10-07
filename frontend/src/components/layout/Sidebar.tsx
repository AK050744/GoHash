import React from 'react'
import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  FileCheck2,
  FolderLock,
  SearchCheck,
  Users,
  ShieldCheck,
  Activity,
  History,
  FileText,
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { UserRole } from '../../types'

interface NavItem {
  label: string
  path: string
  icon: React.ReactNode
}

export const Sidebar: React.FC<{ onCloseMobile?: () => void }> = ({ onCloseMobile }) => {
  const { user } = useAuth()
  const role: UserRole = user?.role || 'USER'

  const linksByRole: Record<UserRole, NavItem[]> = {
    USER: [
      { label: 'Overview', path: '/dashboard', icon: <LayoutDashboard className="w-4 h-4" /> },
      { label: 'Notarize Document', path: '/notarize', icon: <FileCheck2 className="w-4 h-4" /> },
      { label: 'My Documents', path: '/documents', icon: <FolderLock className="w-4 h-4" /> },
      { label: 'Verify On-Chain', path: '/verify', icon: <SearchCheck className="w-4 h-4" /> },
    ],
    NOTARY: [
      { label: 'Notary Dashboard', path: '/notary/dashboard', icon: <LayoutDashboard className="w-4 h-4" /> },
      { label: 'Pending Requests', path: '/notary/pending', icon: <FileText className="w-4 h-4" /> },
      { label: 'Attestation History', path: '/notary/history', icon: <History className="w-4 h-4" /> },
      { label: 'Verify On-Chain', path: '/verify', icon: <SearchCheck className="w-4 h-4" /> },
    ],
    ADMIN: [
      { label: 'Admin Dashboard', path: '/admin/dashboard', icon: <LayoutDashboard className="w-4 h-4" /> },
      { label: 'Authorized Notaries', path: '/admin/notaries', icon: <ShieldCheck className="w-4 h-4" /> },
      { label: 'User Directory', path: '/admin/users', icon: <Users className="w-4 h-4" /> },
      { label: 'System Health', path: '/admin/health', icon: <Activity className="w-4 h-4" /> },
      { label: 'Verify On-Chain', path: '/verify', icon: <SearchCheck className="w-4 h-4" /> },
    ],
  }

  const items = linksByRole[role] || linksByRole.USER

  return (
    <aside className="w-64 h-full bg-surface border-r border-border flex flex-col justify-between py-6 px-4">
      <div>
        {/* Role Badge Indicator */}
        <div className="mb-6 px-3 py-2 rounded-xl bg-surface-secondary border border-border flex items-center justify-between">
          <div>
            <p className="text-[10px] uppercase font-semibold text-dark-400 tracking-wider">Access Scope</p>
            <p className="text-xs font-bold text-white tracking-wide">{role} WORKSPACE</p>
          </div>
          <span className="w-2 h-2 rounded-full bg-accent animate-ping" />
        </div>

        {/* Navigation List */}
        <nav className="space-y-1.5">
          {items.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              onClick={onCloseMobile}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 ${
                  isActive
                    ? 'bg-primary/10 text-primary border border-primary/20 shadow-sm'
                    : 'text-dark-300 hover:text-white hover:bg-surface-secondary'
                }`
              }
            >
              {item.icon}
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>
      </div>

      {/* Footer Info in Sidebar */}
      <div className="px-3 py-3 rounded-xl bg-dark-900/60 border border-border/60 text-center">
        <p className="text-[11px] text-dark-400">Hardhat Local Node</p>
        <p className="text-[10px] text-dark-500 font-mono mt-0.5">Chain ID: 31337</p>
      </div>
    </aside>
  )
}

export default Sidebar
