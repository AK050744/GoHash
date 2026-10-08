import { useState, useEffect, useCallback } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  FileText,
  Upload,
  Copy,
  Check,
  RefreshCw,
  ExternalLink,
  AlertCircle,
  Filter,
} from 'lucide-react'
import Card from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import StatusBadge from '../../components/ui/StatusBadge'
import EmptyState from '../../components/ui/EmptyState'
import Alert from '../../components/ui/Alert'
import { api, ApiError } from '../../lib/api'
import type { Document, DocumentListResponse, DocumentStatus } from '../../types'

const STATUS_FILTERS: { label: string; value: string }[] = [
  { label: 'All', value: '' },
  { label: 'Pending', value: 'PENDING' },
  { label: 'Approved', value: 'APPROVED' },
  { label: 'Rejected', value: 'REJECTED' },
  { label: 'Notarized', value: 'NOTARIZED' },
]

export default function DocumentsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const statusParam = searchParams.get('status')?.toUpperCase() || ''

  const [documents, setDocuments] = useState<Document[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const fetchDocuments = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const endpoint = statusParam
        ? `/documents?status=${encodeURIComponent(statusParam)}`
        : '/documents'
      const res = await api.get<DocumentListResponse>(endpoint)
      if (res && Array.isArray(res.documents)) {
        setDocuments(res.documents)
      } else {
        setDocuments([])
      }
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setError(err.message || 'Failed to load documents')
      } else if (err instanceof Error) {
        setError(err.message)
      } else {
        setError('An unexpected error occurred while loading documents.')
      }
    } finally {
      setLoading(false)
    }
  }, [statusParam])

  useEffect(() => {
    fetchDocuments()
  }, [fetchDocuments])

  const handleFilterChange = (val: string) => {
    if (val) {
      setSearchParams({ status: val })
    } else {
      setSearchParams({})
    }
  }

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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">My Documents</h1>
          <p className="text-surface-400 mt-1">
            Manage your registered documents and monitor their blockchain notarization status.
          </p>
        </div>
        <Link to="/upload">
          <Button variant="primary">
            <Upload className="h-4 w-4" /> Upload Document
          </Button>
        </Link>
      </div>

      {/* Filter tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 border-b border-surface-800">
        <Filter className="h-4 w-4 text-surface-500 mr-1 flex-shrink-0" />
        {STATUS_FILTERS.map((f) => {
          const isActive = statusParam === f.value
          return (
            <button
              key={f.value}
              onClick={() => handleFilterChange(f.value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                isActive
                  ? 'bg-primary-600 text-white'
                  : 'text-surface-400 hover:text-white hover:bg-surface-800'
              }`}
            >
              {f.label}
            </button>
          )
        })}
      </div>

      {/* Error State */}
      {error && (
        <Alert type="error">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 flex-shrink-0" />
              <span>{error}</span>
            </div>
            <Button variant="secondary" size="sm" onClick={fetchDocuments}>
              <RefreshCw className="h-3.5 w-3.5" /> Retry
            </Button>
          </div>
        </Alert>
      )}

      {/* Loading Skeleton */}
      {loading && (
        <Card noPad className="overflow-hidden">
          <div className="p-4 border-b border-surface-700/80 bg-surface-900/50 flex justify-between">
            <div className="h-4 w-32 bg-surface-700/60 rounded animate-pulse" />
            <div className="h-4 w-20 bg-surface-700/60 rounded animate-pulse" />
          </div>
          <div className="divide-y divide-surface-800">
            {[1, 2, 3, 4, 5].map((idx) => (
              <div key={idx} className="p-4 flex items-center justify-between gap-4 animate-pulse">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="h-9 w-9 rounded-lg bg-surface-700/60 flex-shrink-0" />
                  <div className="space-y-2 flex-1">
                    <div className="h-4 w-48 bg-surface-700/60 rounded" />
                    <div className="h-3 w-32 bg-surface-800 rounded" />
                  </div>
                </div>
                <div className="h-6 w-20 bg-surface-700/60 rounded-full" />
                <div className="h-4 w-24 bg-surface-800 rounded hidden md:block" />
                <div className="h-8 w-16 bg-surface-700/60 rounded-xl" />
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Empty State */}
      {!loading && !error && documents.length === 0 && (
        <Card>
          <EmptyState
            icon={<FileText className="h-12 w-12 text-surface-400" />}
            title={statusParam ? `No ${statusParam.toLowerCase()} documents found` : 'No documents yet'}
            description={
              statusParam
                ? 'Try selecting a different status filter or upload a new document.'
                : 'Upload your first PDF document to register its SHA-256 fingerprint.'
            }
            action={
              statusParam ? (
                <Button variant="secondary" onClick={() => handleFilterChange('')}>
                  Clear filter
                </Button>
              ) : (
                <Link to="/upload">
                  <Button variant="primary">
                    <Upload className="h-4 w-4" /> Upload Document
                  </Button>
                </Link>
              )
            }
          />
        </Card>
      )}

      {/* Document Table (Success State) */}
      {!loading && !error && documents.length > 0 && (
        <Card noPad className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-surface-300">
              <thead className="bg-surface-900/60 border-b border-surface-700 text-xs uppercase tracking-wider text-surface-400">
                <tr>
                  <th scope="col" className="px-6 py-4 font-semibold">Document Name</th>
                  <th scope="col" className="px-6 py-4 font-semibold">SHA-256 Hash</th>
                  <th scope="col" className="px-6 py-4 font-semibold">Status</th>
                  <th scope="col" className="px-6 py-4 font-semibold">Uploaded</th>
                  <th scope="col" className="px-6 py-4 font-semibold text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-800">
                {documents.map((doc) => (
                  <tr key={doc.id} className="hover:bg-surface-750/30 transition-colors">
                    {/* Name */}
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-lg bg-surface-900 border border-surface-700 flex items-center justify-center text-primary-400 flex-shrink-0">
                          <FileText className="h-5 w-5" />
                        </div>
                        <div className="min-w-0">
                          <Link
                            to={`/documents/${doc.id}`}
                            className="font-medium text-white hover:text-primary-400 transition truncate block max-w-xs sm:max-w-md"
                          >
                            {doc.originalName}
                          </Link>
                          <span className="text-xs text-surface-500 font-mono">
                            ID: {doc.id}
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* Hash */}
                    <td className="px-6 py-4 whitespace-nowrap">
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

                    {/* Status */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      <StatusBadge status={doc.status as DocumentStatus} />
                    </td>

                    {/* Date */}
                    <td className="px-6 py-4 whitespace-nowrap text-surface-400 text-xs">
                      {formatDate(doc.createdAt)}
                    </td>

                    {/* View Link */}
                    <td className="px-6 py-4 whitespace-nowrap text-right">
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
  )
}
