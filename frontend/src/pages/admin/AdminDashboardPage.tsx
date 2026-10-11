import { useState, useEffect, useCallback } from 'react'
import {
  Users,
  FileText,
  Shield,
  CheckCircle,
  Clock,
  RefreshCw,
  AlertTriangle,
  Copy,
  Check,
  Activity,
  Layers,
  Inbox,
} from 'lucide-react'
import StatCard from '../../components/ui/StatCard'
import Card from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import StatusBadge from '../../components/ui/StatusBadge'
import Spinner from '../../components/ui/Spinner'
import Alert from '../../components/ui/Alert'
import EmptyState from '../../components/ui/EmptyState'
import { api, ApiError } from '../../lib/api'
import type { AdminStatsResponse, AdminActivityResponse, AdminActivityItem } from '../../types'

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<AdminStatsResponse | null>(null)
  const [activity, setActivity] = useState<AdminActivityItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [statsRes, activityRes] = await Promise.all([
        api.get<AdminStatsResponse>('/admin/stats'),
        api.get<AdminActivityResponse>('/admin/activity'),
      ])
      setStats(statsRes)
      setActivity(activityRes.activity || [])
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setError(err.message || 'Failed to fetch admin dashboard data.')
      } else if (err instanceof Error) {
        setError(err.message)
      } else {
        setError('An unexpected error occurred while loading dashboard data.')
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const formatShortAddress = (addr: string | null) => {
    if (!addr) return '—'
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`
  }

  const formatDateTime = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleString(undefined, {
        dateStyle: 'short',
        timeStyle: 'short',
      })
    } catch {
      return dateStr
    }
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
            <Shield className="w-6 h-6 text-primary-400" />
            <span>Admin Overview</span>
          </h1>
          <p className="text-sm text-surface-400 mt-1">
            System metrics, user aggregates, and latest on-chain notarization activity.
          </p>
        </div>

        <Button
          variant="secondary"
          onClick={fetchData}
          disabled={loading}
          className="self-start sm:self-auto flex items-center gap-2"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </Button>
      </div>

      {/* Error state with retry */}
      {error && (
        <Alert type="error">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 flex-shrink-0 text-red-400" />
              <span>{error}</span>
            </div>
            <Button variant="secondary" size="sm" onClick={fetchData}>
              Try Again
            </Button>
          </div>
        </Alert>
      )}

      {/* Loading state */}
      {loading && !stats ? (
        <div className="py-24 flex flex-col items-center justify-center gap-3 text-surface-400">
          <Spinner size="lg" />
          <p className="text-sm">Loading system metrics...</p>
        </div>
      ) : (
        <>
          {/* Stat Cards */}
          {stats && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard
                label="Total Users"
                value={stats.users.total}
                icon={<Users className="w-5 h-5" />}
                trend={`${stats.users.byRole.USER} users • ${stats.users.byRole.NOTARY} notaries • ${stats.users.byRole.ADMIN} admins`}
              />

              <StatCard
                label="Notaries"
                value={stats.notaries.total}
                icon={<Shield className="w-5 h-5" />}
                trend={`${stats.notaries.withWallet} with linked wallet`}
              />

              <StatCard
                label="Total Documents"
                value={stats.documents.total}
                icon={<FileText className="w-5 h-5" />}
                trend={`${stats.documents.byStatus.NOTARIZED} notarized • ${stats.documents.byStatus.PENDING} pending`}
              />

              <StatCard
                label="Notarizations"
                value={stats.notarizations.total}
                icon={<CheckCircle className="w-5 h-5" />}
                trend={`${stats.notarizations.byStatus.CONFIRMED} confirmed • ${stats.notarizations.byStatus.REQUESTED} requested`}
              />
            </div>
          )}

          {/* Detailed breakdown subcards */}
          {stats && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card className="p-5">
                <h3 className="text-sm font-semibold text-white uppercase tracking-wider mb-4 flex items-center gap-2">
                  <Layers className="w-4 h-4 text-primary-400" />
                  <span>Document Status Distribution</span>
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                  <div className="p-3 rounded-xl bg-surface-900/60 border border-surface-800">
                    <span className="text-xs text-surface-400">Notarized</span>
                    <p className="text-lg font-bold text-emerald-400 mt-1">
                      {stats.documents.byStatus.NOTARIZED}
                    </p>
                  </div>
                  <div className="p-3 rounded-xl bg-surface-900/60 border border-surface-800">
                    <span className="text-xs text-surface-400">Pending</span>
                    <p className="text-lg font-bold text-amber-400 mt-1">
                      {stats.documents.byStatus.PENDING}
                    </p>
                  </div>
                  <div className="p-3 rounded-xl bg-surface-900/60 border border-surface-800">
                    <span className="text-xs text-surface-400">Approved</span>
                    <p className="text-lg font-bold text-blue-400 mt-1">
                      {stats.documents.byStatus.APPROVED}
                    </p>
                  </div>
                  <div className="p-3 rounded-xl bg-surface-900/60 border border-surface-800">
                    <span className="text-xs text-surface-400">Rejected</span>
                    <p className="text-lg font-bold text-red-400 mt-1">
                      {stats.documents.byStatus.REJECTED}
                    </p>
                  </div>
                </div>
              </Card>

              <Card className="p-5">
                <h3 className="text-sm font-semibold text-white uppercase tracking-wider mb-4 flex items-center gap-2">
                  <Activity className="w-4 h-4 text-primary-400" />
                  <span>Notarization Pipeline</span>
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-center">
                  <div className="p-2.5 rounded-xl bg-surface-900/60 border border-surface-800">
                    <span className="text-[11px] text-surface-400">Requested</span>
                    <p className="text-base font-bold text-amber-400 mt-1">
                      {stats.notarizations.byStatus.REQUESTED}
                    </p>
                  </div>
                  <div className="p-2.5 rounded-xl bg-surface-900/60 border border-surface-800">
                    <span className="text-[11px] text-surface-400">Approved</span>
                    <p className="text-base font-bold text-blue-400 mt-1">
                      {stats.notarizations.byStatus.APPROVED}
                    </p>
                  </div>
                  <div className="p-2.5 rounded-xl bg-surface-900/60 border border-surface-800">
                    <span className="text-[11px] text-surface-400">Confirmed</span>
                    <p className="text-base font-bold text-emerald-400 mt-1">
                      {stats.notarizations.byStatus.CONFIRMED}
                    </p>
                  </div>
                  <div className="p-2.5 rounded-xl bg-surface-900/60 border border-surface-800">
                    <span className="text-[11px] text-surface-400">Rejected</span>
                    <p className="text-base font-bold text-red-400 mt-1">
                      {stats.notarizations.byStatus.REJECTED}
                    </p>
                  </div>
                  <div className="p-2.5 rounded-xl bg-surface-900/60 border border-surface-800">
                    <span className="text-[11px] text-surface-400">Failed</span>
                    <p className="text-base font-bold text-surface-400 mt-1">
                      {stats.notarizations.byStatus.FAILED}
                    </p>
                  </div>
                </div>
              </Card>
            </div>
          )}

          {/* Recent Activity Table */}
          <Card className="overflow-hidden">
            <div className="p-5 border-b border-surface-700 flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold text-white">Recent Notarization Activity</h2>
                <p className="text-xs text-surface-400 mt-0.5">
                  Latest 50 notarization actions recorded in the system.
                </p>
              </div>
              <span className="text-xs text-surface-400 font-mono">
                {activity.length} entries
              </span>
            </div>

            {activity.length === 0 ? (
              <div className="p-8">
                <EmptyState
                  icon={<Inbox className="w-10 h-10 text-surface-500" />}
                  title="No activity recorded"
                  description="When notarization requests are processed, they will appear here."
                />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-surface-300">
                  <thead className="bg-surface-900/60 text-xs text-surface-400 uppercase tracking-wider border-b border-surface-700">
                    <tr>
                      <th className="px-5 py-3">Status</th>
                      <th className="px-5 py-3">Document</th>
                      <th className="px-5 py-3">Requester</th>
                      <th className="px-5 py-3">Notary Wallet</th>
                      <th className="px-5 py-3">Tx Hash</th>
                      <th className="px-5 py-3 text-right">Updated</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-800">
                    {activity.map((item) => (
                      <tr key={item.id} className="hover:bg-surface-800/40 transition">
                        <td className="px-5 py-3.5 whitespace-nowrap">
                          <StatusBadge status={item.status} />
                        </td>
                        <td className="px-5 py-3.5 font-medium text-white max-w-[200px] truncate">
                          {item.documentName || '—'}
                        </td>
                        <td className="px-5 py-3.5 text-surface-300 whitespace-nowrap">
                          {item.requesterName || '—'}
                        </td>
                        <td className="px-5 py-3.5 whitespace-nowrap font-mono text-xs">
                          {item.notaryWallet ? (
                            <div className="flex items-center gap-1.5">
                              <span>{formatShortAddress(item.notaryWallet)}</span>
                              <button
                                type="button"
                                onClick={() => handleCopy(`notary-${item.id}`, item.notaryWallet!)}
                                className="text-surface-400 hover:text-white transition"
                                title="Copy notary wallet"
                              >
                                {copiedId === `notary-${item.id}` ? (
                                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                                ) : (
                                  <Copy className="w-3.5 h-3.5" />
                                )}
                              </button>
                            </div>
                          ) : (
                            <span className="text-surface-500">—</span>
                          )}
                        </td>
                        <td className="px-5 py-3.5 whitespace-nowrap font-mono text-xs">
                          {item.transactionHash ? (
                            <div className="flex items-center gap-1.5">
                              <span>{formatShortAddress(item.transactionHash)}</span>
                              <button
                                type="button"
                                onClick={() => handleCopy(`tx-${item.id}`, item.transactionHash!)}
                                className="text-surface-400 hover:text-white transition"
                                title="Copy transaction hash"
                              >
                                {copiedId === `tx-${item.id}` ? (
                                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                                ) : (
                                  <Copy className="w-3.5 h-3.5" />
                                )}
                              </button>
                            </div>
                          ) : (
                            <span className="text-surface-500">—</span>
                          )}
                        </td>
                        <td className="px-5 py-3.5 whitespace-nowrap text-right text-xs text-surface-400">
                          <div className="flex items-center justify-end gap-1">
                            <Clock className="w-3 h-3 text-surface-500" />
                            <span>{formatDateTime(item.updatedAt || item.createdAt)}</span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  )
}
