import { NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, FileText, Upload, User, Shield,
  ClipboardList, Users, LogOut, X,
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'

interface Props { open: boolean; onClose: () => void }

function NavItem({ to, icon: Icon, label, onClick }: {
  to: string; icon: React.ElementType; label: string; onClick?: () => void
}) {
  return (
    <NavLink
      to={to}
      onClick={onClick}
      className={({ isActive }) =>
        `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 ${
          isActive
            ? 'bg-primary-600/20 text-primary-300'
            : 'text-surface-400 hover:text-white hover:bg-surface-700'
        }`
      }
    >
      <Icon className="h-4 w-4 flex-shrink-0" />
      {label}
    </NavLink>
  )
}

export default function Sidebar({ open, onClose }: Props) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const doLogout = () => { logout(); navigate('/'); onClose() }

  const userLinks = [
    { to: '/dashboard',  icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/documents',  icon: FileText,         label: 'My Documents' },
    { to: '/upload',     icon: Upload,            label: 'Upload' },
    { to: '/profile',    icon: User,              label: 'Profile' },
    { to: '/verify',     icon: Shield,            label: 'Verify Doc' },
  ]
  const notaryLinks = [
    { to: '/notary/dashboard',    icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/notary/requests',     icon: ClipboardList,   label: 'Requests' },
    { to: '/profile',             icon: User,            label: 'Profile' },
    { to: '/verify',              icon: Shield,          label: 'Verify Doc' },
  ]
  const adminLinks = [
    { to: '/admin/dashboard',  icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/admin/notaries',   icon: Users,           label: 'Notaries' },
    { to: '/profile',          icon: User,            label: 'Profile' },
  ]

  const links =
    user?.role === 'ADMIN'  ? adminLinks  :
    user?.role === 'NOTARY' ? notaryLinks :
    userLinks

  return (
    <>
      {/* Overlay */}
      {open && (
        <div
          className="fixed inset-0 z-30 bg-black/50 lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 bg-surface-900 border-r border-surface-700 flex flex-col
          transition-transform duration-300 lg:static lg:translate-x-0
          ${open ? 'translate-x-0' : '-translate-x-full'}`}
      >
        {/* Header */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-surface-700">
          <span className="font-bold text-white text-lg">GoHash</span>
          <button onClick={onClose} className="lg:hidden text-surface-400 hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* User badge */}
        {user && (
          <div className="px-4 py-3 border-b border-surface-700">
            <p className="text-sm font-semibold text-white truncate">{user.name}</p>
            <p className="text-xs text-surface-400 truncate">{user.email}</p>
            <span className="mt-1 inline-block text-[11px] font-medium text-primary-400 bg-primary-600/10 px-2 py-0.5 rounded-full">
              {user.role}
            </span>
          </div>
        )}

        {/* Nav links */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          {links.map(l => (
            <NavItem key={l.to} {...l} onClick={onClose} />
          ))}
        </nav>

        {/* Logout */}
        <div className="px-3 py-4 border-t border-surface-700">
          <button
            onClick={doLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-surface-400 hover:text-red-400 hover:bg-red-500/10 transition-all duration-150"
          >
            <LogOut className="h-4 w-4" /> Log out
          </button>
        </div>
      </aside>
    </>
  )
}
