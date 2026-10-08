import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import {
  FileText,
  Upload,
  CheckCircle,
  Clock,
  ArrowRight,
  RefreshCw,
  AlertCircle,
  Copy,
  Check,
  ExternalLink,
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import StatCard from '../../components/ui/StatCard'
import EmptyState from '../../components/ui/EmptyState'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import Alert from '../../components/ui/Alert'
import StatusBadge from '../../components/ui/StatusBadge'
import { api, ApiError } from '../../lib/api'
import type {
  Document,
  DocumentStats,
  DocumentStatsResponse,
  DocumentListResponse,
  DocumentStatus,
} from '../../types'

export default function DashboardPage() {
  const { user } = useAuth()

  // Stats state
  const [stats, setStats] = useState<DocumentStats | null>(null)
  const [statsLoading, setStatsLoading] = useState(true)
  const [statsError, setStatsError] = useState<string | null>(null)

  // Recent documents state
  const [recentDocs, setRecentDocs] = useState<Document[]>([])
  const [docsLoading, setDocsLoading] = useState(true)
  const [docsError, setDocsError] = useState<string | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const fetchStats = useCallback(async () => {
    setStatsLoading(true)
    setStatsError(null)
    try {
      const res = await api.get<DocumentStatsResponse>('/documents/stats')
      if (res && typeof res.total === 'number') {
        setStats({
          total: res.total,
          pending: res.pending,
          notarized: res.notarized,
        })
      } else if (res?.stats) {
        setStats(res.stats)
      } else {
        throw new Error('Invalid statistics data from server')
      }
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setStatsError(err.message || 'Failed to load document statistics')
      } else if (err instanceof Error) {
        setStatsError(err.message)
      } else {
        setStatsError('Unable to load statistics')
      }
    } finally {
      setStatsLoading(false)
    }
  }, [])

  const fetchRecentDocuments = useCallback(async () => {
    setDocsLoading(true)
    setDocsError(null)
    try {
      const res = await api.get<DocumentListResponse>('/documents')
      if (res && Array.isArray(res.documents)) {
        setRecentDocs(res.documents.slice(0, 5))
      } else {
        setRecentDocs([])
      }
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setDocsError(err.message || 'Failed to load recent documents')
      } else if (err instanceof Error) {
        setDocsError(err.message)
      } else {
        setDocsError('Unable to load recent documents')
      }
    } finally {
      setDocsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchStats()
    fetchRecentDocuments()
  }, [fetchStats, fetchRecentDocuments])

  const handleCopy = (id: string, hash: string) => {
    navigator.clipboard.writeText(hash)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const formatHash = (hash: string) => {
    if (!hash || hash.length <= 14) return hash || '—'
    return `${hash.slice(0, 8)}...${hash.slice(-6)}`
  }

  const formatDate = (isoString: string) => {
    try {
      const d = new Date(isoString)
      return d.toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    } catch {
      return isoString
    }
  }

  return (
    <div className="space-y-8">
      {/* Greeting and Quick Action */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">
            Hello, {user?.name?.split(' ')[0] || 'there'} 👋
          </h1>
          <p className="text-surface-400 mt-1">
            Here is a live summary of your registered documents and notarization status.
          </p>
        </div>
        <Link to="/upload">
          <Button variant="primary">
            <Upload className="h-4 w-4" /> Upload Document
          </Button>
        </Link>
      </div>

      {/* Stats Section: Exactly 3 StatCards (Total, Pending, Notarized) */}
      <div>
        {statsError ? (
          <Alert type="error">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 flex-shrink-0" />
                <span>{statsError}</span>
              </div>
              <Button variant="secondary" size="sm" onClick={fetchStats}>
                <RefreshCw className="h-3.5 w-3.5" /> Retry
              </Button>
            </div>
          </Alert>
        ) : statsLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[1, 2, 3].map((idx) => (
              <div
                key={idx}
                className="bg-surface-800 border border-surface-700 rounded-2xl p-5 flex flex-col gap-3 animate-pulse"
              >
                <div className="flex items-center justify-between">
                  <div className="h-4 w-28 bg-surface-700/60 rounded" />
                  <div className="h-5 w-5 bg-surface-700/60 rounded-full" />
                </div>
                <div className="h-8 w-16 bg-surface-700/60 rounded" />
              </div>
            ))}
          </div>
        ) : stats ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <StatCard
              label="Total Documents"
              value={stats.total}
              icon={<FileText className="h-5 w-5" />}
            />
            <StatCard
              label="Pending Notarization"
              value={stats.pending}
              icon={<Clock className="h-5 w-5" />}
            />
            <StatCard
              label="Notarized"
              value={stats.notarized}
              icon={<CheckCircle className="h-5 w-5" />}
            />
          </div>
        ) : null}
      </div>

      {/* Recent Documents Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-white">Recent Documents</h2>
            <p className="text-xs text-surface-400">Up to 5 most recently uploaded documents</p>
          </div>
          <Link
            to="/documents"
            className="text-xs text-primary-400 hover:text-primary-300 font-medium flex items-center gap-1 transition"
          >
            View all documents <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        {docsError ? (
          <Alert type="error">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 flex-shrink-0" />
                <span>{docsError}</span>
              </div>
              <Button variant="secondary" size="sm" onClick={fetchRecentDocuments}>
                <RefreshCw className="h-3.5 w-3.5" /> Retry
              </Button>
            </div>
          </Alert>
        ) : docsLoading ? (
          <Card noPad className="overflow-hidden">
            <div className="divide-y divide-surface-800">
              {[1, 2, 3].map((idx) => (
                <div
                  key={idx}
                  className="p-4 flex items-center justify-between gap-4 animate-pulse"
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="h-9 w-9 rounded-lg bg-surface-700/60 flex-shrink-0" />
                    <div className="space-y-2 flex-1">
                      <div className="h-4 w-44 bg-surface-700/60 rounded" />
                      <div className="h-3 w-28 bg-surface-800 rounded" />
                    </div>
                  </div>
                  <div className="h-6 w-20 bg-surface-700/60 rounded-full" />
                  <div className="h-8 w-16 bg-surface-700/60 rounded-xl" />
                </div>
              ))}
            </div>
          </Card>
        ) : recentDocs.length === 0 ? (
          <Card>
            <EmptyState
              icon={<FileText className="h-12 w-12 text-surface-400" />}
              title="No documents yet"
              description="Upload your first document to calculate its cryptographic SHA-256 fingerprint."
              action={
                <Link to="/upload">
                  <Button variant="primary">
                    <Upload className="h-4 w-4" /> Upload Document
                  </Button>
                </Link>
              }
            />
          </Card>
        ) : (
          <Card noPad className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-surface-300">
                <thead className="bg-surface-900/60 border-b border-surface-700 text-xs uppercase tracking-wider text-surface-400">
                  <tr>
                    <th scope="col" className="px-6 py-3.5 font-semibold">Document</th>
                    <th scope="col" className="px-6 py-3.5 font-semibold">SHA-256 Hash</th>
                    <th scope="col" className="px-6 py-3.5 font-semibold">Status</th>
                    <th scope="col" className="px-6 py-3.5 font-semibold">Uploaded</th>
                    <th scope="col" className="px-6 py-3.5 font-semibold text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-800">
                  {recentDocs.map((doc) => (
                    <tr key={doc.id} className="hover:bg-surface-750/30 transition-colors">
                      <td className="px-6 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-lg bg-surface-900 border border-surface-700 flex items-center justify-center text-primary-400 flex-shrink-0">
                            <FileText className="h-4 w-4" />
                          </div>
                          <div className="min-w-0">
                            <Link
                              to={`/documents/${doc.id}`}
                              className="font-medium text-white hover:text-primary-400 transition truncate block max-w-xs"
                            >
                              {doc.originalName}
                            </Link>
                          </div>
                        </div>
                      </td>

                      <td className="px-6 py-3.5 whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5 font-mono text-xs bg-surface-900 px-2.5 py-1 rounded-md border border-surface-800">
                          <span className="text-surface-300">{formatHash(doc.sha256Hash)}</span>
                          <button
                            type="button"
                            onClick={() => handleCopy(doc.id, doc.sha256Hash)}
                            className="text-surface-500 hover:text-white transition p-0.5"
                            title="Copy full SHA-256 hash"
                          >
                            {copiedId === doc.id ? (
                              <Check className="h-3.5 w-3.5 text-green-400" />
                            ) : (
                              <Copy className="h-3.5 w-3.5" />
                            )}
                          </button>
                        </div>
                      </td>

                      <td className="px-6 py-3.5 whitespace-nowrap">
                        <StatusBadge status={doc.status as DocumentStatus} />
                      </td>

                      <td className="px-6 py-3.5 whitespace-nowrap text-surface-400 text-xs">
                        {formatDate(doc.createdAt)}
                      </td>

                      <td className="px-6 py-3.5 whitespace-nowrap text-right">
                        <Link to={`/documents/${doc.id}`}>
                          <Button variant="ghost" size="sm">
                            View <ExternalLink className="h-3.5 w-3.5 ml-1" />
                          </Button>
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </div>
    </div>
  )
}
