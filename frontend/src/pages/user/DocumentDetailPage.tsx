import { useState, useEffect, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import {
  FileText,
  Copy,
  Check,
  ExternalLink,
  ArrowLeft,
  AlertCircle,
  CheckCircle,
  Clock,
  Shield,
  FileQuestion,
  RefreshCw,
} from 'lucide-react'
import Card from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import StatusBadge from '../../components/ui/StatusBadge'
import Alert from '../../components/ui/Alert'
import { api, ApiError } from '../../lib/api'
import type {
  Document,
  DocumentDetailResponse,
  DocumentStatus,
  NotarizationRequestResponse,
} from '../../types'

export default function DocumentDetailPage() {
  const { id } = useParams<{ id: string }>()

  const [document, setDocument] = useState<Document | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Actions state
  const [openingPdf, setOpeningPdf] = useState(false)
  const [pdfError, setPdfError] = useState<string | null>(null)
  const [copiedHash, setCopiedHash] = useState(false)
  const [copiedTxHash, setCopiedTxHash] = useState(false)

  // Notarization request state
  const [showConfirmModal, setShowConfirmModal] = useState(false)
  const [requestingNotarization, setRequestingNotarization] = useState(false)
  const [notarizationSuccess, setNotarizationSuccess] = useState<string | null>(null)
  const [notarizationError, setNotarizationError] = useState<string | null>(null)
  const [isRequestDisabled, setIsRequestDisabled] = useState(false)

  const fetchDocument = useCallback(async () => {
    if (!id) return
    setLoading(true)
    setError(null)
    setNotFound(false)

    try {
      const res = await api.get<DocumentDetailResponse>(`/documents/${id}`)
      if (res && res.document) {
        setDocument(res.document)
      } else {
        setError('Document record missing from server response.')
      }
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        if (err.status === 404 || err.code === 'NOT_FOUND') {
          setNotFound(true)
        } else {
          setError(err.message || 'Failed to fetch document.')
        }
      } else if (err instanceof Error) {
        setError(err.message)
      } else {
        setError('An unexpected error occurred while fetching document details.')
      }
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    fetchDocument()
  }, [fetchDocument])

  const handleCopyHash = (hash: string) => {
    navigator.clipboard.writeText(hash)
    setCopiedHash(true)
    setTimeout(() => setCopiedHash(false), 2000)
  }

  const handleCopyTxHash = (txHash: string) => {
    navigator.clipboard.writeText(txHash)
    setCopiedTxHash(true)
    setTimeout(() => setCopiedTxHash(false), 2000)
  }

  const handleOpenPdf = async () => {
    if (!id || openingPdf) return
    setOpeningPdf(true)
    setPdfError(null)

    try {
      const blob = await api.getBlob(`/documents/${id}/file`)
      const blobUrl = URL.createObjectURL(blob)
      window.open(blobUrl, '_blank')
      // Revoke the object URL after 60 seconds to release memory
      setTimeout(() => {
        URL.revokeObjectURL(blobUrl)
      }, 60000)
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setPdfError(err.message || 'Unable to open document PDF.')
      } else if (err instanceof Error) {
        setPdfError(err.message)
      } else {
        setPdfError('An error occurred while loading the PDF document.')
      }
    } finally {
      setOpeningPdf(false)
    }
  }

  const handleConfirmRequestNotarization = async () => {
    if (!id || requestingNotarization) return
    setRequestingNotarization(true)
    setNotarizationError(null)
    setNotarizationSuccess(null)

    try {
      await api.post<NotarizationRequestResponse>('/notarization/request', {
        documentId: id,
      })
      setNotarizationSuccess('Notarization request submitted successfully')
      setIsRequestDisabled(true)
      setShowConfirmModal(false)
      fetchDocument()
    } catch (err: unknown) {
      setShowConfirmModal(false)
      if (err instanceof ApiError) {
        if (err.code === 'DUPLICATE_REQUEST' || err.status === 409) {
          setNotarizationError('A request already exists for this document')
          setIsRequestDisabled(true)
        } else {
          setNotarizationError(err.message || 'Failed to request notarization.')
        }
      } else if (err instanceof Error) {
        setNotarizationError(err.message)
      } else {
        setNotarizationError('An unexpected error occurred.')
      }
    } finally {
      setRequestingNotarization(false)
    }
  }

  const formatFileSize = (bytes?: number) => {
    if (bytes === undefined || bytes === null) return '—'
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
  }

  const formatDate = (isoString?: string) => {
    if (!isoString) return '—'
    try {
      const d = new Date(isoString)
      return d.toLocaleString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    } catch {
      return isoString
    }
  }

  // 404 State
  if (notFound) {
    return (
      <div className="max-w-2xl mx-auto py-12 text-center space-y-6">
        <div className="mx-auto h-16 w-16 rounded-full bg-surface-800 border border-surface-700 flex items-center justify-center text-surface-400">
          <FileQuestion className="h-8 w-8 text-primary-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">Document Not Found</h1>
          <p className="text-surface-400 mt-2 max-w-md mx-auto">
            The document you requested does not exist or you do not have permission to view it.
          </p>
        </div>
        <div>
          <Link to="/documents">
            <Button variant="secondary">
              <ArrowLeft className="h-4 w-4" /> Back to My Documents
            </Button>
          </Link>
        </div>
      </div>
    )
  }

  // General Loading Skeleton
  if (loading) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center gap-2">
          <div className="h-8 w-24 bg-surface-800 rounded animate-pulse" />
        </div>
        <Card className="space-y-4 animate-pulse">
          <div className="h-7 w-64 bg-surface-700 rounded" />
          <div className="h-4 w-40 bg-surface-800 rounded" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4">
            <div className="h-24 bg-surface-900 rounded-xl" />
            <div className="h-24 bg-surface-900 rounded-xl" />
          </div>
        </Card>
      </div>
    )
  }

  // General Error State
  if (error || !document) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <Link to="/documents">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4" /> Back to My Documents
          </Button>
        </Link>
        <Alert type="error">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 flex-shrink-0" />
              <span>{error || 'Failed to load document details.'}</span>
            </div>
            <Button variant="secondary" size="sm" onClick={fetchDocument}>
              <RefreshCw className="h-3.5 w-3.5" /> Retry
            </Button>
          </div>
        </Alert>
      </div>
    )
  }

  const not = document.notarization
  const hasNotarization = Boolean(not)

  // Success State
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Top Navigation */}
      <div className="flex items-center justify-between">
        <Link to="/documents">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4" /> Back to My Documents
          </Button>
        </Link>
      </div>

      {/* Notifications */}
      {pdfError && (
        <Alert type="error">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            <span>{pdfError}</span>
          </div>
        </Alert>
      )}

      {notarizationSuccess && (
        <Alert type="success">
          <div className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4 flex-shrink-0" />
            <span>{notarizationSuccess}</span>
          </div>
        </Alert>
      )}

      {notarizationError && (
        <Alert type="warning">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            <span>{notarizationError}</span>
          </div>
        </Alert>
      )}

      {/* Main Header Card */}
      <Card className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
          <div className="flex items-start gap-3 min-w-0">
            <div className="h-11 w-11 rounded-xl bg-surface-900 border border-surface-700 flex items-center justify-center text-primary-400 flex-shrink-0 mt-0.5">
              <FileText className="h-6 w-6" />
            </div>
            <div className="space-y-1 min-w-0">
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-2xl font-bold text-white truncate">{document.originalName}</h1>
                <StatusBadge status={document.status as DocumentStatus} />
              </div>
              <p className="text-xs text-surface-400 font-mono">
                Document ID: {document.id}
              </p>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-3 flex-wrap">
            <Button
              variant="secondary"
              loading={openingPdf}
              onClick={handleOpenPdf}
            >
              <ExternalLink className="h-4 w-4" /> Open PDF
            </Button>

            {/* Hide "Request Notarization" once a notarization exists or if not PENDING */}
            {document.status === 'PENDING' && !hasNotarization && (
              <Button
                variant="primary"
                disabled={isRequestDisabled || requestingNotarization}
                loading={requestingNotarization}
                onClick={() => setShowConfirmModal(true)}
              >
                <Shield className="h-4 w-4" />
                {isRequestDisabled ? 'Request Submitted' : 'Request Notarization'}
              </Button>
            )}
          </div>
        </div>

        {/* Confirmation Modal / Step */}
        {showConfirmModal && (
          <div className="bg-surface-900 border border-primary-500/40 rounded-xl p-5 space-y-4">
            <div className="flex items-start gap-3">
              <Clock className="h-5 w-5 text-primary-400 mt-0.5 flex-shrink-0" />
              <div>
                <h3 className="text-sm font-semibold text-white">
                  Confirm Notarization Request
                </h3>
                <p className="text-xs text-surface-400 mt-1">
                  Are you sure you want to request notarization for this document? A certified notary will review this document and record the attestation on the blockchain.
                </p>
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 pt-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowConfirmModal(false)}
                disabled={requestingNotarization}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                loading={requestingNotarization}
                onClick={handleConfirmRequestNotarization}
              >
                Confirm Request
              </Button>
            </div>
          </div>
        )}

        {/* Primary Metadata Details */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
          {/* Document Name */}
          <div className="bg-surface-900 border border-surface-700/80 rounded-xl p-4">
            <span className="text-xs text-surface-400 block mb-1">Document Name</span>
            <span className="text-sm font-medium text-white break-words">{document.originalName}</span>
          </div>

          {/* Document ID */}
          <div className="bg-surface-900 border border-surface-700/80 rounded-xl p-4">
            <span className="text-xs text-surface-400 block mb-1">Document ID</span>
            <span className="text-sm font-mono text-primary-300 break-all">{document.id}</span>
          </div>

          {/* Upload Date */}
          <div className="bg-surface-900 border border-surface-700/80 rounded-xl p-4">
            <span className="text-xs text-surface-400 block mb-1">Upload Date</span>
            <span className="text-sm font-medium text-white">{formatDate(document.createdAt)}</span>
          </div>

          {/* File Size */}
          <div className="bg-surface-900 border border-surface-700/80 rounded-xl p-4">
            <span className="text-xs text-surface-400 block mb-1">File Size</span>
            <span className="text-sm font-medium text-white">{formatFileSize(document.fileSize)}</span>
          </div>
        </div>

        {/* SHA-256 Fingerprint */}
        <div className="bg-surface-900 border border-surface-700/80 rounded-xl p-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-surface-400 font-mono uppercase tracking-wider">
              Cryptographic SHA-256 Fingerprint
            </span>
            <button
              type="button"
              onClick={() => handleCopyHash(document.sha256Hash)}
              className="inline-flex items-center gap-1.5 text-xs text-surface-400 hover:text-white px-2 py-1 rounded bg-surface-800 hover:bg-surface-700 transition"
              title="Copy SHA-256 hash"
            >
              {copiedHash ? (
                <>
                  <Check className="h-3.5 w-3.5 text-green-400" />
                  <span className="text-green-400">Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" />
                  <span>Copy Hash</span>
                </>
              )}
            </button>
          </div>
          <div className="bg-surface-950 p-3 rounded-lg border border-surface-800">
            <code className="text-xs font-mono text-primary-300 break-all select-all block leading-relaxed">
              {document.sha256Hash}
            </code>
          </div>
        </div>
      </Card>

      {/* Blockchain & Notarization Status */}
      <Card className="space-y-4">
        <div className="flex items-center gap-2 border-b border-surface-700 pb-3">
          <Shield className="h-5 w-5 text-primary-400" />
          <h2 className="text-lg font-semibold text-white">Blockchain & Notarization Status</h2>
        </div>

        <div className="divide-y divide-surface-800 text-sm">
          {/* Notary */}
          <div className="py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
            <span className="text-surface-400">Notary</span>
            {not?.notaryWallet ? (
              <span className="text-white font-medium text-xs">Authorized Notary</span>
            ) : (
              <span className="text-surface-500 font-mono text-xs">Not notarized yet</span>
            )}
          </div>

          {/* Notary wallet */}
          <div className="py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
            <span className="text-surface-400">Notary Wallet</span>
            {not?.notaryWallet ? (
              <code className="text-xs font-mono text-primary-300 break-all select-all">
                {not.notaryWallet}
              </code>
            ) : (
              <span className="text-surface-500 font-mono text-xs">Not notarized yet</span>
            )}
          </div>

          {/* Timestamp */}
          <div className="py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
            <span className="text-surface-400">Recorded on-chain at</span>
            {not?.timestamp ? (
              <span className="text-white font-medium text-xs">
                Recorded on-chain at {formatDate(new Date(not.timestamp * 1000).toISOString())}
              </span>
            ) : (
              <span className="text-surface-500 font-mono text-xs">Not recorded on-chain yet</span>
            )}
          </div>

          {/* Transaction hash */}
          <div className="py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
            <span className="text-surface-400">Transaction Hash</span>
            {not?.transactionHash ? (
              <div className="flex items-center gap-2">
                <code className="text-xs font-mono text-emerald-300 break-all select-all">
                  {not.transactionHash}
                </code>
                <button
                  type="button"
                  onClick={() => handleCopyTxHash(not.transactionHash!)}
                  className="p-1 hover:text-white text-surface-400 rounded transition flex-shrink-0"
                  title="Copy transaction hash"
                >
                  {copiedTxHash ? (
                    <Check className="h-3.5 w-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                </button>
              </div>
            ) : (
              <span className="text-surface-500 font-mono text-xs">Not notarized yet</span>
            )}
          </div>

          {/* Block number */}
          <div className="py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
            <span className="text-surface-400">Block Number</span>
            {not?.blockNumber ? (
              <span className="text-white font-mono font-medium text-xs">
                #{not.blockNumber}
              </span>
            ) : (
              <span className="text-surface-500 font-mono text-xs">Not notarized yet</span>
            )}
          </div>

          {/* Contract address */}
          <div className="py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
            <span className="text-surface-400">Contract Address</span>
            {not?.contractAddress ? (
              <code className="text-xs font-mono text-surface-300 break-all select-all">
                {not.contractAddress}
              </code>
            ) : (
              <span className="text-surface-500 font-mono text-xs">Not notarized yet</span>
            )}
          </div>

          {/* IPFS CID */}
          <div className="py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
            <span className="text-surface-400">IPFS CID</span>
            <span className="text-surface-500 font-mono text-xs">
              {document.ipfsCid || 'None'}
            </span>
          </div>
        </div>
      </Card>
    </div>
  )
}
