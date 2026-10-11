import { useState, useEffect, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import {
  Shield,
  Printer,
  ArrowLeft,
  CheckCircle,
  FileText,
  Copy,
  Check,
  AlertCircle,
  Clock,
} from 'lucide-react'
import Card from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Alert from '../../components/ui/Alert'
import Spinner from '../../components/ui/Spinner'
import { api, ApiError } from '../../lib/api'
import type { Document, DocumentDetailResponse } from '../../types'

export default function NotarizationCertificatePage() {
  const { id } = useParams<{ id: string }>()
  const [document, setDocument] = useState<Document | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [copiedHash, setCopiedHash] = useState(false)
  const [copiedTx, setCopiedTx] = useState(false)

  const fetchDocument = useCallback(async () => {
    if (!id) return
    setLoading(true)
    setError(null)

    try {
      const res = await api.get<DocumentDetailResponse>(`/documents/${id}`)
      if (res && res.document) {
        setDocument(res.document)
      } else {
        setError('Document record not found.')
      }
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        if (err.status === 404 || err.code === 'NOT_FOUND') {
          setError('Document not found or you do not have permission to view it.')
        } else {
          setError(err.message || 'Failed to load document details.')
        }
      } else if (err instanceof Error) {
        setError(err.message)
      } else {
        setError('An unexpected error occurred while loading the certificate.')
      }
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    fetchDocument()
  }, [fetchDocument])

  const handlePrint = () => {
    window.print()
  }

  const handleCopyHash = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopiedHash(true)
    setTimeout(() => setCopiedHash(false), 2000)
  }

  const handleCopyTx = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopiedTx(true)
    setTimeout(() => setCopiedTx(false), 2000)
  }

  const formatTimestamp = (unixSeconds: number | null | undefined) => {
    if (!unixSeconds) return '—'
    return new Date(unixSeconds * 1000).toLocaleString(undefined, {
      dateStyle: 'full',
      timeStyle: 'medium',
    })
  }

  if (loading) {
    return (
      <div className="py-24 flex flex-col items-center justify-center gap-3 text-surface-400">
        <Spinner size="lg" />
        <p className="text-sm">Loading notarization certificate...</p>
      </div>
    )
  }

  if (error || !document) {
    return (
      <div className="max-w-2xl mx-auto py-12 px-4">
        <Alert type="error">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <span>{error || 'Document not found.'}</span>
          </div>
        </Alert>
        <div className="mt-6 text-center">
          <Link to="/documents">
            <Button variant="secondary">
              <ArrowLeft className="w-4 h-4" /> Back to My Documents
            </Button>
          </Link>
        </div>
      </div>
    )
  }

  const not = document.notarization
  const isConfirmed =
    document.status === 'NOTARIZED' || not?.status === 'CONFIRMED'

  // If document has not been notarized yet, show friendly message with link back
  if (!isConfirmed) {
    return (
      <div className="max-w-xl mx-auto py-16 px-4 text-center">
        <Card className="p-8">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-400 flex items-center justify-center mx-auto mb-4 border border-amber-500/20">
            <Clock className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">
            This document has not been notarized yet
          </h2>
          <p className="text-sm text-surface-400 mb-6 max-w-sm mx-auto">
            A certificate of notarization is generated once a notary reviews and confirms the attestation on the blockchain.
          </p>
          <div className="flex items-center justify-center gap-3">
            <Link to={`/documents/${document.id}`}>
              <Button variant="primary">
                <ArrowLeft className="w-4 h-4" /> Back to Document Details
              </Button>
            </Link>
          </div>
        </Card>
      </div>
    )
  }

  const onChainTime = not?.onChainTimestamp || not?.timestamp

  return (
    <div className="max-w-4xl mx-auto space-y-6 px-4 py-4 sm:py-6">
      {/* Top action bar — hidden during print */}
      <div className="flex items-center justify-between gap-4 print:hidden">
        <Link to={`/documents/${document.id}`}>
          <Button variant="ghost" size="sm">
            <ArrowLeft className="w-4 h-4" /> Back to Document
          </Button>
        </Link>

        <div className="flex items-center gap-3">
          <Button
            variant="primary"
            onClick={handlePrint}
            className="flex items-center gap-2"
          >
            <Printer className="w-4 h-4" />
            <span>Print / Save as PDF</span>
          </Button>
        </div>
      </div>

      {/* ── Official Certificate Card ──────────────────────────────────────── */}
      <div
        id="notarization-certificate"
        className="relative bg-surface-900 border-2 border-primary-500/30 rounded-3xl p-8 sm:p-12 shadow-2xl overflow-hidden print:border print:border-black print:bg-white print:text-black print:shadow-none print:p-8 print:m-0"
      >
        {/* Decorative corner accents */}
        <div className="absolute top-0 left-0 w-24 h-24 border-t-2 border-l-2 border-primary-500/40 rounded-tl-3xl pointer-events-none print:border-black" />
        <div className="absolute top-0 right-0 w-24 h-24 border-t-2 border-r-2 border-primary-500/40 rounded-tr-3xl pointer-events-none print:border-black" />
        <div className="absolute bottom-0 left-0 w-24 h-24 border-b-2 border-l-2 border-primary-500/40 rounded-bl-3xl pointer-events-none print:border-black" />
        <div className="absolute bottom-0 right-0 w-24 h-24 border-b-2 border-r-2 border-primary-500/40 rounded-br-3xl pointer-events-none print:border-black" />

        {/* Certificate Header */}
        <div className="text-center pb-8 border-b border-surface-700/80 print:border-gray-300">
          <div className="inline-flex p-3 rounded-2xl bg-primary-500/10 text-primary-400 mb-3 border border-primary-500/20 print:border-black print:text-black print:bg-transparent">
            <Shield className="w-10 h-10" />
          </div>
          <p className="text-xs font-bold uppercase tracking-widest text-primary-400 print:text-black">
            GoHash Digital Notary Protocol
          </p>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight mt-1 print:text-black">
            Certificate of Notarization
          </h1>
          <p className="text-sm text-surface-400 mt-2 print:text-gray-700 max-w-lg mx-auto">
            Independently verifiable tamper-evident attestation recorded on the smart contract blockchain.
          </p>
        </div>

        {/* Status Badge Ribbon */}
        <div className="py-6 flex items-center justify-center gap-3">
          <div className="px-4 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-sm font-semibold flex items-center gap-2 print:border-black print:text-black print:bg-transparent">
            <CheckCircle className="w-4 h-4 text-emerald-400 print:text-black" />
            <span>STATUS: {document.status} (CONFIRMED)</span>
          </div>
        </div>

        {/* Certificate Body Attributes */}
        <div className="space-y-6 pt-2">
          {/* Document Name & ID */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 rounded-2xl bg-surface-950/60 border border-surface-800 print:bg-gray-50 print:border-gray-300">
            <div className="md:col-span-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-surface-400 print:text-gray-600">
                Document Name
              </span>
              <p className="text-lg font-bold text-white mt-1 break-all flex items-center gap-2 print:text-black">
                <FileText className="w-5 h-5 text-primary-400 flex-shrink-0 print:text-black" />
                {document.originalName}
              </p>
            </div>
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-surface-400 print:text-gray-600">
                Document ID
              </span>
              <p className="text-sm font-mono text-surface-200 mt-1 break-all print:text-black">
                {document.id}
              </p>
            </div>
          </div>

          {/* Cryptographic SHA-256 Digest */}
          <div className="p-4 rounded-2xl bg-surface-950/60 border border-surface-800 print:bg-gray-50 print:border-gray-300">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-semibold uppercase tracking-wider text-surface-400 print:text-gray-600">
                Cryptographic SHA-256 Digest
              </span>
              <button
                type="button"
                onClick={() => handleCopyHash(document.sha256Hash)}
                className="text-xs text-primary-400 hover:text-primary-300 flex items-center gap-1 transition print:hidden"
                title="Copy hash"
              >
                {copiedHash ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-emerald-400 font-medium">Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy</span>
                  </>
                )}
              </button>
            </div>
            <p className="font-mono text-xs sm:text-sm text-surface-200 break-all p-2.5 rounded-lg bg-surface-900 border border-surface-800/80 print:bg-white print:border-gray-200 print:text-black">
              {document.sha256Hash}
            </p>
          </div>

          {/* On-Chain Record Details Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Timestamp */}
            <div className="p-4 rounded-2xl bg-surface-950/60 border border-surface-800 sm:col-span-2 print:bg-gray-50 print:border-gray-300">
              <span className="text-xs font-semibold uppercase tracking-wider text-surface-400 print:text-gray-600">
                Blockchain Block Timestamp
              </span>
              <p className="text-base font-semibold text-white mt-1 print:text-black">
                Recorded on-chain at {formatTimestamp(onChainTime)}
              </p>
              <p className="text-xs text-surface-400 mt-1 print:text-gray-600">
                Significance: The cryptographic hash of this file was committed to the blockchain no later than this recorded block timestamp.
              </p>
            </div>

            {/* Notary Wallet */}
            <div className="p-4 rounded-2xl bg-surface-950/60 border border-surface-800 print:bg-gray-50 print:border-gray-300">
              <span className="text-xs font-semibold uppercase tracking-wider text-surface-400 print:text-gray-600">
                Attesting Notary Wallet
              </span>
              <p className="font-mono text-xs text-surface-200 mt-1 break-all print:text-black">
                {not?.notaryWallet || '—'}
              </p>
            </div>

            {/* Contract Address */}
            <div className="p-4 rounded-2xl bg-surface-950/60 border border-surface-800 print:bg-gray-50 print:border-gray-300">
              <span className="text-xs font-semibold uppercase tracking-wider text-surface-400 print:text-gray-600">
                Smart Contract Address
              </span>
              <p className="font-mono text-xs text-surface-200 mt-1 break-all print:text-black">
                {not?.contractAddress || '—'}
              </p>
            </div>

            {/* Transaction Hash */}
            <div className="p-4 rounded-2xl bg-surface-950/60 border border-surface-800 print:bg-gray-50 print:border-gray-300">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-semibold uppercase tracking-wider text-surface-400 print:text-gray-600">
                  Transaction Hash
                </span>
                {not?.transactionHash && (
                  <button
                    type="button"
                    onClick={() => handleCopyTx(not.transactionHash!)}
                    className="text-xs text-primary-400 hover:text-primary-300 flex items-center gap-1 transition print:hidden"
                    title="Copy tx hash"
                  >
                    {copiedTx ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="text-emerald-400 font-medium">Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copy</span>
                      </>
                    )}
                  </button>
                )}
              </div>
              <p className="font-mono text-xs text-surface-200 break-all print:text-black">
                {not?.transactionHash || '—'}
              </p>
            </div>

            {/* Block Number */}
            <div className="p-4 rounded-2xl bg-surface-950/60 border border-surface-800 print:bg-gray-50 print:border-gray-300">
              <span className="text-xs font-semibold uppercase tracking-wider text-surface-400 print:text-gray-600">
                Block Number
              </span>
              <p className="text-base font-semibold text-white mt-1 print:text-black">
                {not?.blockNumber !== undefined && not?.blockNumber !== null
                  ? `#${not.blockNumber}`
                  : '—'}
              </p>
            </div>
          </div>
        </div>

        {/* Certificate Disclaimer Footer */}
        <div className="mt-8 pt-6 border-t border-surface-700/80 text-center print:border-gray-300">
          <p className="text-xs text-surface-400 font-medium leading-relaxed max-w-2xl mx-auto print:text-gray-700">
            Technical integrity proof of this document's SHA-256 hash.
            Not a substitute for legally recognized notarization.
          </p>
        </div>
      </div>
    </div>
  )
}
