import { useAuth } from '../../context/AuthContext'
import StatCard from '../../components/ui/StatCard'
import EmptyState from '../../components/ui/EmptyState'
import { FileText, Upload, CheckCircle, Clock } from 'lucide-react'
import { Link } from 'react-router-dom'
import Button from '../../components/ui/Button'

export default function DashboardPage() {
  const { user } = useAuth()

  return (
    <div className="space-y-8">
      {/* Greeting */}
      <div>
        <h1 className="text-2xl font-bold text-white">
          Hello, {user?.name?.split(' ')[0]} 👋
        </h1>
        <p className="text-surface-400 mt-1">Here's what's happening with your documents.</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Docs"  value="—" icon={<FileText className="h-4 w-4" />} />
        <StatCard label="Notarized"   value="—" icon={<CheckCircle className="h-4 w-4" />} />
        <StatCard label="Pending"     value="—" icon={<Clock className="h-4 w-4" />} />
        <StatCard label="Uploaded"    value="—" icon={<Upload className="h-4 w-4" />} />
      </div>

      {/* Empty state */}
      <EmptyState
        icon={<FileText />}
        title="No documents yet"
        description="Upload your first document to get started."
        action={
          <Link to="/upload">
            <Button><Upload className="h-4 w-4" /> Upload document</Button>
          </Link>
        }
      />
    </div>
  )
}
