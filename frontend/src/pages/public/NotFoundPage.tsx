import { Link } from 'react-router-dom'
import Button from '../../components/ui/Button'

export default function NotFoundPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-6 text-center px-4">
      <p className="text-7xl font-black text-primary-500">404</p>
      <h1 className="text-3xl font-bold text-white">Page not found</h1>
      <p className="text-surface-400 max-w-xs">The page you're looking for doesn't exist or has been moved.</p>
      <Link to="/"><Button>Go home</Button></Link>
    </div>
  )
}
