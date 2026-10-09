import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import {
  FileText,
  Copy,
  Check,
  ArrowRight,
  AlertTriangle,
  RefreshCw,
  ClipboardList,
  Wallet,
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { api, ApiError } from '../../lib/api'
import Card from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import EmptyState from '../../components/ui/EmptyState'
import Alert from '../../components/ui/Alert'
import type { PendingNotarizationItem, PendingNotarizationsResponse } from '../../types'

export default function NotaryDashboardPage() {
  const { user } = useAuth()

  const [requests, setRequests] = useState<PendingNotarizationItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [copiedHash, setCopiedHash] = useState<string | null>(null)

  const fetchPendingRequests = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const res = await api.get<PendingNotarizationsResponse>('/notarization/pending')
      if (res && Array.isArray(res.notarizations)) {
        setRequests(res.notarizations)
      } else {
        setRequests([])
      }
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setError(err.message || 'Failed to fetch pending notarization requests.')
      } else if (err instanceof Error) {
        setError(err.message)
      } else {
        setError('An unexpected error occurred while loading requests.')
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchPendingRequests()
  }, [fetchPendingRequests])

  const handleCopyHash = (hash: string) => {
    navigator.clipboard.writeText(hash)
    setCopiedHash(hash)
    setTimeout(() => setCopiedHash(null), 2000)
  }

  const formatDate = (isoString?: string) => {
    if (!isoString) return '—'
    try {
      const d = new Date(isoString)
      return d.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    } catch {
      return isoString
    }
  }

  const truncateHash = (hash: string) => {
    if (!hash || hash.length < 16) return hash
    return `${hash.slice(0, 8)}...${hash.slice(-6)}`
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Notary Review Dashboard</h1>
          <p className="text-surface-400 text-sm mt-1">
            Review submitted documents and issue on-chain cryptographic attestations.
          </p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={fetchPendingRequests}
          loading={loading}
          disabled={loading}
        >
          <RefreshCw className="h-4 w-4" />
          <span>Refresh</span>
        </Button>
      </div>

      {/* Banner when Notary has no linked wallet */}
      {!user?.walletAddress && (
        <Alert type="warning">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-start gap-2.5">
              <AlertTriangle className="h-5 w-5 text-amber-400 flex-shrink-0 mt-0.5" />
              <div className="text-sm">
                <span className="font-semibold text-amber-200 block">
                  Action Required: No Linked Wallet
                </span>
                <span className="text-xs text-amber-300/90">
                  You have not linked an Ethereum wallet to your notary account. You must link an authorized notary wallet before you can sign and approve notarizations on-chain.
                </span>
              </div>
            </div>
            <Link to="/profile" className="flex-shrink-0">
              <Button size="sm" variant="primary">
                <Wallet className="h-3.5 w-3.5" />
                <span>Link Wallet Now</span>
              </Button>
            </Link>
          </div>
        </Alert>
      )}

      {/* Error state */}
      {error && (
        <Alert type="error">
          <div className="flex items-center justify-between gap-4">
            <span>{error}</span>
            <Button size="sm" variant="secondary" onClick={fetchPendingRequests}>
              <RefreshCw className="h-3.5 w-3.5" />
              <span>Retry</span>
            </Button>
          </div>
        </Alert>
      )}

      {/* Table Card */}
      <Card className="p-0 overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-surface-700/80 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5 text-primary-400" />
            <h2 className="font-semibold text-white">Pending Requests Queue</h2>
            <span className="ml-2 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-surface-800 text-surface-300 border border-surface-700">
              {requests.length}
            </span>
          </div>
        </div>

        {/* Loading Skeletons */}
        {loading ? (
          <div className="p-6 space-y-4 animate-pulse">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-14 bg-surface-800 rounded-xl" />
            ))}
          </div>
        ) : requests.length === 0 ? (
          <div className="py-12">
            <EmptyState
              icon={<ClipboardList className="h-10 w-10 text-surface-500" />}
              title="No Pending Requests"
              description="All document notarization requests have been reviewed and processed."
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-surface-900/60 text-xs font-medium text-surface-400 uppercase tracking-wider border-b border-surface-800">
                <tr>
                  <th scope="col" className="px-6 py-3.5">Document</th>
                  <th scope="col" className="px-6 py-3.5">Owner</th>
                  <th scope="col" className="px-6 py-3.5">SHA-256 Hash</th>
                  <th scope="col" className="px-6 py-3.5">Requested Date</th>
                  <th scope="col" className="px-6 py-3.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-800 text-surface-200">
                {requests.map((item) => {
                  const docDisplay = item.document?.originalName || `Document ${item.documentId.slice(0, 8)}...`
                  const ownerDisplay = item.owner?.name || item.owner?.email || `${item.requestedBy.slice(0, 8)}...`

                  return (
                    <tr
                      key={item.id}
                      className="hover:bg-surface-800/40 transition duration-150"
                    >
                      {/* Document column */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2.5">
                          <FileText className="h-4 w-4 text-primary-400 flex-shrink-0" />
                          <span className="font-medium text-white max-w-[200px] truncate" title={docDisplay}>
                            {docDisplay}
                          </span>
                        </div>
                      </td>

                      {/* Owner column */}
                      <td className="px-6 py-4 text-surface-300">
                        <span className="text-xs font-mono">{ownerDisplay}</span>
                      </td>

                      {/* Hash column with copy */}
                      <td className="px-6 py-4 font-mono text-xs">
                        <div className="flex items-center gap-2">
                          <span className="text-primary-300 bg-surface-900 px-2 py-0.5 rounded border border-surface-800">
                            {truncateHash(item.documentHash)}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleCopyHash(item.documentHash)}
                            className="p-1 hover:text-white text-surface-400 rounded transition"
                            title="Copy full SHA-256 hash"
                          >
                            {copiedHash === item.documentHash ? (
                              <Check className="h-3.5 w-3.5 text-emerald-400" />
                            ) : (
                              <Copy className="h-3.5 w-3.5" />
                            )}
                          </button>
                        </div>
                      </td>

                      {/* Date column */}
                      <td className="px-6 py-4 text-xs text-surface-400 whitespace-nowrap">
                        {formatDate(item.createdAt)}
                      </td>

                      {/* Actions */}
                      <td className="px-6 py-4 text-right">
                        <Link to={`/notary/requests/${item.id}`}>
                          <Button size="sm" variant="secondary">
                            <span>Review</span>
                            <ArrowRight className="h-3.5 w-3.5" />
                          </Button>
                        </Link>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}
