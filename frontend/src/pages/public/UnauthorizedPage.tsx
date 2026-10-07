import { Link } from 'react-router-dom'
import { ShieldOff } from 'lucide-react'
import Button from '../../components/ui/Button'

export default function UnauthorizedPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-6 text-center px-4">
      <ShieldOff className="h-16 w-16 text-red-400" />
      <span className="text-sm font-semibold tracking-wider text-red-400 uppercase">403 Forbidden</span>
      <h1 className="text-3xl font-bold text-white">Access denied</h1>
      <p className="text-surface-400 max-w-xs">You don't have permission to view this page.</p>
      <Link to="/"><Button variant="secondary">Back home</Button></Link>
    </div>
  )
}
