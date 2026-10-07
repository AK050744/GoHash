import React from 'react'
import { useNavigate } from 'react-router-dom'
import { FileCheck, FileClock, Shield, ArrowUpRight, FolderLock, Plus, Search } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { DashboardLayout } from '../../components/layout/DashboardLayout'
import { StatCard } from '../../components/ui/StatCard'
import { Card, CardHeader, CardTitle, CardDescription } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { EmptyState } from '../../components/ui/EmptyState'

export const DashboardPage: React.FC = () => {
  const { user } = useAuth()
  const navigate = useNavigate()

  return (
    <DashboardLayout>
      <div className="space-y-8">
        {/* Welcome Banner */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight font-display">
              Welcome back, {user?.name || 'User'}
            </h1>
            <p className="text-sm text-dark-400 mt-1">
              Manage your cryptographic document certificates and on-chain proofs
            </p>
          </div>
          <div className="flex items-center gap-2.5">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => navigate('/verify')}
              leftIcon={<Search className="w-4 h-4 text-accent" />}
            >
              Verify Hash
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => navigate('/notarize')}
              leftIcon={<Plus className="w-4 h-4" />}
            >
              New Notarization
            </Button>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Total Documents"
            value="0"
            icon={<FolderLock className="w-5 h-5" />}
            description="Stored in your account"
          />
          <StatCard
            title="On-Chain Notarized"
            value="0"
            icon={<FileCheck className="w-5 h-5 text-emerald-400" />}
            description="Certified on Ethereum"
          />
          <StatCard
            title="Pending Requests"
            value="0"
            icon={<FileClock className="w-5 h-5 text-amber-400" />}
            description="Awaiting notary review"
          />
          <StatCard
            title="Wallet State"
            value={user?.walletAddress ? 'Linked' : 'Not Linked'}
            icon={<Shield className="w-5 h-5 text-accent" />}
            description={user?.walletAddress ? 'Ethereum ready' : 'Connect for web3'}
          />
        </div>

        {/* Recent Documents Section */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Recent Documents</CardTitle>
              <CardDescription>Your recently hashed and notarized certificates</CardDescription>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/documents')}
              rightIcon={<ArrowUpRight className="w-4 h-4" />}
            >
              View All
            </Button>
          </CardHeader>

          <EmptyState
            icon={<FolderLock className="w-8 h-8 text-primary" />}
            title="No documents yet"
            description="Upload and hash your first legal document, patent, or certificate to anchor it on the blockchain."
            action={
              <Button
                variant="primary"
                size="sm"
                onClick={() => navigate('/notarize')}
                leftIcon={<Plus className="w-4 h-4" />}
              >
                Notarize First Document
              </Button>
            }
          />
        </Card>
      </div>
    </DashboardLayout>
  )
}

export default DashboardPage
