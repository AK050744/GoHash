import { useState, useEffect, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ethers } from 'ethers'
import {
  FileText,
  Copy,
  Check,
  ExternalLink,
  ArrowLeft,
  AlertTriangle,
  CheckCircle,
  Clock,
  Shield,
  FileQuestion,
  RefreshCw,
  XCircle,
} from 'lucide-react'
import Card from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import StatusBadge from '../../components/ui/StatusBadge'
import Alert from '../../components/ui/Alert'
import { useAuth } from '../../context/AuthContext'
import { useWallet } from '../../context/WalletContext'
import { api, ApiError } from '../../lib/api'
import { EXPECTED_CHAIN_NAME } from '../../lib/env'
import type {
  PendingNotarizationItem,
  Document,
  ApproveNotarizationResponse,
  ConfirmNotarizationResponse,
  DocumentDetailResponse,
  NotarizationDetailResponse,
} from '../../types'

type ApproveState =
  | 'idle'
  | 'preparing'
  | 'awaiting-wallet'
  | 'pending'
  | 'verifying'
  | 'confirmed'
  | 'failed'
  | 'rejected-by-user'

export default function NotaryRequestDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuth()
  const {
    address,
    isCorrectNetwork,
    connect,
    switchNetwork,
    getSigner,
  } = useWallet()

  // Base data state
  const [notarization, setNotarization] = useState<PendingNotarizationItem | null>(null)
  const [document, setDocument] = useState<Document | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Actions state
  const [openingPdf, setOpeningPdf] = useState(false)
  const [pdfError, setPdfError] = useState<string | null>(null)
  const [copiedHash, setCopiedHash] = useState(false)
  const [copiedTxHash, setCopiedTxHash] = useState(false)

  // Reject modal state
  const [showRejectModal, setShowRejectModal] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const [rejecting, setRejecting] = useState(false)
  const [rejectError, setRejectError] = useState<string | null>(null)
  const [rejectSuccess, setRejectSuccess] = useState<string | null>(null)

  // Approve flow state machine
  const [approveState, setApproveState] = useState<ApproveState>('idle')
  const [activeTxHash, setActiveTxHash] = useState<string | null>(null)
  const [flowError, setFlowError] = useState<string | null>(null)
  const [cachedTxHash, setCachedTxHash] = useState<string | null>(null)

  const sessionKey = id ? `notarization_tx_${id}` : ''

  // Load session storage cached tx on mount
  useEffect(() => {
    if (sessionKey) {
      const saved = sessionStorage.getItem(sessionKey)
      if (saved) {
        setCachedTxHash(saved)
      }
    }
  }, [sessionKey])

  // Extract real document ID if populated as string or object
  const extractDocId = (docField: unknown): string | null => {
    if (!docField) return null
    if (typeof docField === 'string') {
      const match = docField.match(/[a-f0-9]{24}/i)
      return match ? match[0] : docField
    }
    if (typeof docField === 'object' && docField !== null) {
      const obj = docField as { _id?: string; id?: string }
      return obj._id || obj.id || null
    }
    return null
  }

  const fetchRequestDetails = useCallback(async () => {
    if (!id) return
    setLoading(true)
    setError(null)
    setNotFound(false)

    try {
      // 1. Fetch Notarization record
      const notRes = await api.get<NotarizationDetailResponse>(`/notarization/${id}`)
      if (!notRes || !notRes.notarization) {
        setNotFound(true)
        return
      }

      const notData = notRes.notarization
      setNotarization(notData)

      // If already CONFIRMED, clear sessionStorage
      if (notData.status === 'CONFIRMED' && sessionKey) {
        sessionStorage.removeItem(sessionKey)
        setCachedTxHash(null)
      }

      // 2. Fetch associated document details
      const docId = extractDocId(notData.documentId)
      if (docId) {
        try {
          const docRes = await api.get<DocumentDetailResponse>(`/documents/${docId}`)
          if (docRes && docRes.document) {
            setDocument(docRes.document)
          }
        } catch {
          // Document fetch issue; details fallback to notarization record
        }
      }
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        if (err.status === 404 || err.code === 'NOT_FOUND') {
          setNotFound(true)
        } else {
          setError(err.message || 'Failed to fetch notarization request.')
        }
      } else if (err instanceof Error) {
        setError(err.message)
      } else {
        setError('An unexpected error occurred while loading request details.')
      }
    } finally {
      setLoading(false)
    }
  }, [id, sessionKey])

  useEffect(() => {
    fetchRequestDetails()
  }, [fetchRequestDetails])

  const handleCopy = (text: string, isTx = false) => {
    navigator.clipboard.writeText(text)
    if (isTx) {
      setCopiedTxHash(true)
      setTimeout(() => setCopiedTxHash(false), 2000)
    } else {
      setCopiedHash(true)
      setTimeout(() => setCopiedHash(false), 2000)
    }
  }

  // Helper to map every server and blockchain error code readably
  const mapNotarizationError = (err: unknown): string => {
    if (err instanceof ApiError) {
      if (err.code === 'WALLET_NOT_LINKED') {
        return 'You must link a wallet address on your Profile before approving notarizations.'
      }
      if (err.code === 'NOTARY_NOT_AUTHORIZED_ON_CHAIN') {
        return 'Your wallet is not authorized as a notary on the smart contract.'
      }
      if (err.code === 'OWNER_WALLET_REQUIRED') {
        return 'The document owner must link an Ethereum wallet before the document can be notarized.'
      }
      if (err.code === 'ALREADY_NOTARIZED') {
        return 'This document hash has already been notarized on the blockchain.'
      }
      if (err.code === 'REASON_REQUIRED') {
        return 'Rejection reason is required.'
      }
      if (err.code === 'INVALID_STATE') {
        return err.message || 'The notarization request is in an invalid state for this operation.'
      }
      if (
        err.code === 'CONTRACT_NOT_DEPLOYED' ||
        err.code === 'CHAIN_UNREACHABLE' ||
        err.status === 503
      ) {
        return 'Blockchain node not reachable. Start the local node and redeploy the contract.'
      }
      if (err.code === 'VERIFICATION_FAILED' || err.status === 422) {
        const msg = err.message || ''
        if (msg.includes('TX_NOT_FOUND')) {
          return 'Verification failed: Transaction not found on chain.'
        }
        if (msg.includes('WRONG_CONTRACT')) {
          return 'Verification failed: Transaction destination does not match the configured contract address.'
        }
        if (msg.includes('WRONG_SIGNER')) {
          return "Verification failed: Transaction was not signed by the notary's linked wallet."
        }
        if (msg.includes('WRONG_HASH')) {
          return 'Verification failed: Document hash in transaction receipt does not match this document.'
        }
        if (msg.includes('already used by another confirmed notarization')) {
          return 'Verification failed: Transaction hash is already used by another confirmed notarization.'
        }
        if (msg.includes('WRONG_CHAIN')) {
          return 'Verification failed: Transaction was submitted on the wrong network chain.'
        }
        if (msg.includes('EVENT_NOT_FOUND')) {
          return 'Verification failed: DocumentNotarized event missing from transaction receipt.'
        }
        if (msg.includes('WRONG_EVENT_NOTARY')) {
          return 'Verification failed: The on-chain event records a different notary than your linked wallet.'
        }
        return `Verification failed: ${msg}`
      }
      return err.message || 'An error occurred during notarization.'
    }
    if (err instanceof Error) {
      return err.message
    }
    return 'An unexpected error occurred.'
  }

  // Open PDF via JWT blob streaming (open new tab synchronously first to avoid popup blockers)
  const handleOpenPdf = async () => {
    const docId = extractDocId(notarization?.documentId)
    if (!docId || openingPdf) return

    setOpeningPdf(true)
    setPdfError(null)

    // Open new tab synchronously in user event handler to avoid popup blockers
    const newTab = window.open('about:blank', '_blank')

    try {
      const blob = await api.getBlob(`/documents/${docId}/file`)
      const blobUrl = URL.createObjectURL(blob)
      if (newTab) {
        newTab.location.href = blobUrl
      } else {
        window.open(blobUrl, '_blank')
      }
      setTimeout(() => {
        URL.revokeObjectURL(blobUrl)
      }, 60000)
    } catch (err: unknown) {
      if (newTab) {
        newTab.close()
      }
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

  // Reject flow
  const handleConfirmReject = async () => {
    if (!id || rejecting || !rejectReason.trim()) return

    setRejecting(true)
    setRejectError(null)

    try {
      const res = await api.post<{ success: boolean; notarization: PendingNotarizationItem }>(
        `/notarization/${id}/reject`,
        { reason: rejectReason.trim() }
      )
      if (res && res.notarization) {
        setNotarization(res.notarization)
      }
      setShowRejectModal(false)
      setRejectSuccess('Notarization request has been rejected.')
    } catch (err: unknown) {
      setRejectError(mapNotarizationError(err))
    } finally {
      setRejecting(false)
    }
  }

  // Server receipt confirmation and polling routine
  const executeServerConfirm = async (txHash: string) => {
    setApproveState('verifying')
    setActiveTxHash(txHash)
    setFlowError(null)

    const maxAttempts = 15 // 15 attempts * 2000ms = 30 seconds
    let attempts = 0

    while (attempts < maxAttempts) {
      attempts++
      try {
        const res = await api.post<ConfirmNotarizationResponse>(
          `/notarization/${id}/confirm`,
          { transactionHash: txHash }
        )

        // 202 TX_PENDING: poll again in 2 seconds
        if (res.code === 'TX_PENDING' || res.status === 'TX_PENDING') {
          if (attempts < maxAttempts) {
            await new Promise((resolve) => setTimeout(resolve, 2000))
            continue
          } else {
            setApproveState('failed')
            setFlowError(
              'Transaction has not yet mined on-chain after 30 seconds. Click "Confirm previous transaction" to retry.'
            )
            return
          }
        }

        // Success / Confirmed
        if (res.notarization && res.notarization.status === 'CONFIRMED') {
          if (sessionKey) {
            sessionStorage.removeItem(sessionKey)
            setCachedTxHash(null)
          }
          setApproveState('confirmed')
          setNotarization(res.notarization)
          return
        }

        // On-chain reverted / FAILED
        if (res.notarization && res.notarization.status === 'FAILED') {
          setApproveState('failed')
          setFlowError(res.notarization.failureReason || 'Transaction reverted on-chain.')
          setNotarization(res.notarization)
          return
        }

        // If returned success without explicit status
        if (res.success) {
          if (sessionKey) {
            sessionStorage.removeItem(sessionKey)
            setCachedTxHash(null)
          }
          setApproveState('confirmed')
          if (res.notarization) setNotarization(res.notarization)
          return
        }
      } catch (err: unknown) {
        if (err instanceof ApiError) {
          // Terminal error from server
          setApproveState('failed')
          setFlowError(mapNotarizationError(err))
          return
        }

        // Retry on network hitch before maxAttempts
        if (attempts < maxAttempts) {
          await new Promise((resolve) => setTimeout(resolve, 2000))
          continue
        }

        setApproveState('failed')
        setFlowError(mapNotarizationError(err))
        return
      }
    }
  }

  // Full approval state machine
  const handleApprove = async () => {
    if (!id) return
    setFlowError(null)

    // Step 1: Preparing (POST /notarization/:id/approve)
    setApproveState('preparing')

    let approveData: ApproveNotarizationResponse
    try {
      approveData = await api.post<ApproveNotarizationResponse>(`/notarization/${id}/approve`)
    } catch (err: unknown) {
      setApproveState('failed')
      setFlowError(mapNotarizationError(err))
      return
    }

    // Step 2: Awaiting Wallet (MetaMask popup)
    setApproveState('awaiting-wallet')

    let tx: ethers.ContractTransactionResponse
    try {
      const signer = await getSigner()
      const contract = new ethers.Contract(
        approveData.contractAddress,
        approveData.abi as ethers.InterfaceAbi,
        signer
      )

      tx = await contract[approveData.method](...approveData.args)
    } catch (err: unknown) {
      const ethErr = err as { code?: number | string; message?: string }
      if (
        ethErr.code === 4001 ||
        ethErr.code === 'ACTION_REJECTED' ||
        ethErr.message?.toLowerCase().includes('user rejected') ||
        ethErr.message?.toLowerCase().includes('rejected')
      ) {
        setApproveState('rejected-by-user')
        setFlowError('Transaction was rejected by user in MetaMask.')
      } else {
        setApproveState('failed')
        setFlowError(ethErr.message || 'Transaction submission failed in MetaMask.')
      }
      return
    }

    // Step 3: Pending on-chain
    const txHash = tx.hash
    setActiveTxHash(txHash)
    if (sessionKey) {
      sessionStorage.setItem(sessionKey, txHash)
      setCachedTxHash(txHash)
    }
    setApproveState('pending')

    try {
      const receipt = await tx.wait(1)
      if (!receipt || receipt.status === 0) {
        setApproveState('failed')
        setFlowError('Transaction reverted on-chain.')
        return
      }
    } catch (waitErr: unknown) {
      setApproveState('failed')
      const wErr = waitErr as { message?: string }
      setFlowError(wErr.message || 'Failed while waiting for transaction confirmation.')
      return
    }

    // Step 4: Verifying on backend (POST /notarization/:id/confirm)
    await executeServerConfirm(txHash)
  }

  // Preconditions for Approve button
  const isWalletConnected = Boolean(address)
  const isCorrectChain = Boolean(isCorrectNetwork)
  const isNotaryWalletLinked = Boolean(user?.walletAddress)
  const isAccountMatching = Boolean(
    address && user?.walletAddress && address.toLowerCase() === user.walletAddress.toLowerCase()
  )

  const isCurrentStatusApprovable =
    notarization?.status === 'REQUESTED' ||
    notarization?.status === 'APPROVED' ||
    notarization?.status === 'FAILED'

  const isActionInProgress =
    approveState === 'preparing' ||
    approveState === 'awaiting-wallet' ||
    approveState === 'pending' ||
    approveState === 'verifying'

  const canApprove =
    isWalletConnected &&
    isCorrectChain &&
    isNotaryWalletLinked &&
    isAccountMatching &&
    isCurrentStatusApprovable &&
    !isActionInProgress

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

  const formatFileSize = (bytes?: number) => {
    if (bytes === undefined || bytes === null) return '—'
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
  }

  // 404 state
  if (notFound) {
    return (
      <div className="max-w-2xl mx-auto py-12 text-center space-y-6">
        <div className="mx-auto h-16 w-16 rounded-full bg-surface-800 border border-surface-700 flex items-center justify-center text-surface-400">
          <FileQuestion className="h-8 w-8 text-primary-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">Notarization Request Not Found</h1>
          <p className="text-surface-400 mt-2 max-w-md mx-auto">
            The requested notarization record does not exist or you do not have permission to view it.
          </p>
        </div>
        <div>
          <Link to="/notary/dashboard">
            <Button variant="secondary">
              <ArrowLeft className="h-4 w-4" /> Back to Dashboard
            </Button>
          </Link>
        </div>
      </div>
    )
  }

  // Loading state
  if (loading) {
    return (
      <div className="max-w-4xl mx-auto space-y-6 animate-pulse">
        <div className="h-8 w-32 bg-surface-800 rounded" />
        <Card className="h-64 bg-surface-900/60" />
      </div>
    )
  }

  // General error state
  if (error || !notarization) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <Link to="/notary/dashboard">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4" /> Back to Dashboard
          </Button>
        </Link>
        <Alert type="error">
          <div className="flex items-center justify-between gap-4">
            <span>{error || 'Failed to load request details.'}</span>
            <Button variant="secondary" size="sm" onClick={fetchRequestDetails}>
              <RefreshCw className="h-3.5 w-3.5" /> Retry
            </Button>
          </div>
        </Alert>
      </div>
    )
  }

  const documentName = document?.originalName || 'Document Attestation'
  const documentHash = document?.sha256Hash || notarization.documentHash
  const isFinalized = notarization.status === 'CONFIRMED'

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Top Navigation */}
      <div className="flex items-center justify-between">
        <Link to="/notary/dashboard">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4" /> Back to Dashboard
          </Button>
        </Link>
      </div>

      {/* Notifications */}
      {pdfError && (
        <Alert type="error">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 flex-shrink-0" />
            <span>{pdfError}</span>
          </div>
        </Alert>
      )}

      {rejectSuccess && (
        <Alert type="success">
          <div className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 flex-shrink-0" />
            <span>{rejectSuccess}</span>
          </div>
        </Alert>
      )}

      {/* SessionStorage recovery banner */}
      {cachedTxHash && !isFinalized && approveState === 'idle' && (
        <Alert type="warning">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-start gap-2.5">
              <Clock className="h-5 w-5 text-amber-400 flex-shrink-0 mt-0.5" />
              <div className="text-xs space-y-1">
                <span className="font-semibold text-amber-200 block text-sm">
                  Unconfirmed Transaction Detected
                </span>
                <span>
                  Found previous transaction hash:{' '}
                  <span className="font-mono text-amber-300">
                    {cachedTxHash.slice(0, 10)}...{cachedTxHash.slice(-8)}
                  </span>
                  . If this transaction was submitted before page reload, you can verify it directly with the server.
                </span>
              </div>
            </div>
            <Button
              size="sm"
              variant="primary"
              onClick={() => executeServerConfirm(cachedTxHash)}
              className="flex-shrink-0"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              <span>Confirm previous transaction</span>
            </Button>
          </div>
        </Alert>
      )}

      {/* Main Request Header Card */}
      <Card className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
          <div className="flex items-start gap-3 min-w-0">
            <div className="h-11 w-11 rounded-xl bg-surface-900 border border-surface-700 flex items-center justify-center text-primary-400 flex-shrink-0 mt-0.5">
              <FileText className="h-6 w-6" />
            </div>
            <div className="space-y-1 min-w-0">
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-2xl font-bold text-white truncate">{documentName}</h1>
                <StatusBadge status={notarization.status} />
              </div>
              <p className="text-xs text-surface-400 font-mono">
                Request ID: {notarization.id}
              </p>
            </div>
          </div>

          {/* Top Actions: Open PDF & Review actions */}
          <div className="flex items-center gap-3 flex-wrap">
            <Button
              variant="secondary"
              loading={openingPdf}
              onClick={handleOpenPdf}
            >
              <ExternalLink className="h-4 w-4" /> Open PDF
            </Button>

            {!isFinalized && notarization.status !== 'REJECTED' && (
              <>
                <Button
                  variant="ghost"
                  disabled={isActionInProgress}
                  onClick={() => setShowRejectModal(true)}
                  className="text-red-400 hover:text-red-300 hover:bg-red-500/10 border border-red-500/30"
                >
                  <XCircle className="h-4 w-4" /> Reject
                </Button>

                <Button
                  variant="primary"
                  disabled={!canApprove}
                  loading={isActionInProgress}
                  onClick={handleApprove}
                >
                  <Shield className="h-4 w-4" />
                  <span>
                    {isActionInProgress ? 'Processing...' : 'Approve & Notarize'}
                  </span>
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Disabled Approval Reason Explanation */}
        {!canApprove && isCurrentStatusApprovable && !isActionInProgress && (
          <div className="p-3 bg-surface-900/80 border border-amber-500/30 rounded-xl flex items-start gap-2.5 text-xs text-amber-200">
            <AlertTriangle className="h-4 w-4 text-amber-400 flex-shrink-0 mt-0.5" />
            <div className="space-y-1">
              <span className="font-semibold block">Approval is currently disabled:</span>
              <ul className="list-disc pl-4 space-y-0.5 text-surface-300">
                {!isNotaryWalletLinked && (
                  <li>
                    You must link an authorized notary wallet on your{' '}
                    <Link to="/profile" className="text-primary-400 underline">
                      Profile page
                    </Link>{' '}
                    first.
                  </li>
                )}
                {!isWalletConnected && (
                  <li>
                    MetaMask wallet is not connected.{' '}
                    <button
                      type="button"
                      onClick={connect}
                      className="text-primary-400 underline font-medium"
                    >
                      Connect Wallet
                    </button>
                  </li>
                )}
                {isWalletConnected && !isCorrectChain && (
                  <li>
                    Wrong network detected. Must be connected to {EXPECTED_CHAIN_NAME}.{' '}
                    <button
                      type="button"
                      onClick={switchNetwork}
                      className="text-primary-400 underline font-medium"
                    >
                      Switch Network
                    </button>
                  </li>
                )}
                {isWalletConnected && isNotaryWalletLinked && !isAccountMatching && (
                  <li>
                    Connected MetaMask account (
                    <span className="font-mono text-amber-300">
                      {address?.slice(0, 6)}...{address?.slice(-4)}
                    </span>
                    ) does not match your registered notary wallet (
                    <span className="font-mono text-amber-300">
                      {user?.walletAddress?.slice(0, 6)}...{user?.walletAddress?.slice(-4)}
                    </span>
                    ). Please switch accounts in MetaMask.
                  </li>
                )}
              </ul>
            </div>
          </div>
        )}

        {/* Reject Dialog Modal */}
        {showRejectModal && (
          <div className="bg-surface-900 border border-red-500/40 rounded-xl p-5 space-y-4 shadow-xl">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-red-400 mt-0.5 flex-shrink-0" />
              <div className="space-y-1 w-full">
                <h3 className="text-sm font-semibold text-white">
                  Reject Notarization Request
                </h3>
                <p className="text-xs text-surface-400">
                  Please provide a clear justification for rejecting this document. This reason will be recorded and displayed to the document owner.
                </p>
                {rejectError && (
                  <div className="text-xs text-red-400 pt-1">{rejectError}</div>
                )}
                <div className="pt-2">
                  <textarea
                    rows={3}
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    placeholder="Enter reason for rejection (required)..."
                    className="w-full bg-surface-950 border border-surface-700 rounded-lg p-2.5 text-xs text-white placeholder-surface-500 focus:outline-none focus:border-red-500"
                  />
                </div>
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 pt-2 border-t border-surface-800">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowRejectModal(false)}
                disabled={rejecting}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                loading={rejecting}
                disabled={!rejectReason.trim()}
                onClick={handleConfirmReject}
                className="bg-red-600 hover:bg-red-500"
              >
                Confirm Rejection
              </Button>
            </div>
          </div>
        )}

        {/* Metadata Details Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
          {/* Document Name */}
          <div className="bg-surface-900 border border-surface-800 rounded-xl p-4">
            <span className="text-xs text-surface-400 block mb-1">Document Name</span>
            <span className="text-sm font-medium text-white break-words">{documentName}</span>
          </div>

          {/* Requester / Owner */}
          <div className="bg-surface-900 border border-surface-800 rounded-xl p-4">
            <span className="text-xs text-surface-400 block mb-1">Requested By (User ID)</span>
            <span className="text-sm font-mono text-primary-300 break-all">
              {notarization.requestedBy}
            </span>
          </div>

          {/* Submission Date */}
          <div className="bg-surface-900 border border-surface-800 rounded-xl p-4">
            <span className="text-xs text-surface-400 block mb-1">Requested At</span>
            <span className="text-sm font-medium text-white">{formatDate(notarization.createdAt)}</span>
          </div>

          {/* File Size */}
          <div className="bg-surface-900 border border-surface-800 rounded-xl p-4">
            <span className="text-xs text-surface-400 block mb-1">File Size</span>
            <span className="text-sm font-medium text-white">{formatFileSize(document?.fileSize)}</span>
          </div>
        </div>

        {/* SHA-256 Fingerprint */}
        <div className="bg-surface-900 border border-surface-800 rounded-xl p-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-surface-400 font-mono uppercase tracking-wider">
              Cryptographic SHA-256 Fingerprint
            </span>
            <button
              type="button"
              onClick={() => handleCopy(documentHash, false)}
              className="inline-flex items-center gap-1.5 text-xs text-surface-400 hover:text-white px-2 py-1 rounded bg-surface-800 hover:bg-surface-700 transition"
              title="Copy SHA-256 hash"
            >
              {copiedHash ? (
                <>
                  <Check className="h-3.5 w-3.5 text-emerald-400" />
                  <span className="text-emerald-400">Copied!</span>
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
              {documentHash}
            </code>
          </div>
        </div>

        {/* Rejection Reason display if rejected */}
        {notarization.status === 'REJECTED' && notarization.rejectionReason && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 space-y-1">
            <span className="text-xs font-semibold text-red-300 block">Rejection Reason</span>
            <p className="text-xs text-red-200">{notarization.rejectionReason}</p>
          </div>
        )}
      </Card>

      {/* Explicit Approval Flow State Machine & Step List */}
      <Card className="space-y-6">
        <div className="border-b border-surface-700/80 pb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary-400" />
            <h2 className="text-lg font-semibold text-white">Notarization Execution State</h2>
          </div>
          <div className="text-xs text-surface-400">
            State: <span className="font-mono text-primary-300 font-semibold uppercase">{approveState}</span>
          </div>
        </div>

        {/* Visual Stepper List */}
        <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
          {/* Step 1: Preparing */}
          <div
            className={`p-3 rounded-xl border transition ${
              approveState === 'preparing'
                ? 'bg-primary-500/10 border-primary-500/50 text-white'
                : ['awaiting-wallet', 'pending', 'verifying', 'confirmed'].includes(approveState)
                ? 'bg-surface-900 border-emerald-500/30 text-emerald-300'
                : 'bg-surface-900/50 border-surface-800 text-surface-400'
            }`}
          >
            <div className="flex items-center gap-2 mb-1">
              {['awaiting-wallet', 'pending', 'verifying', 'confirmed'].includes(approveState) ? (
                <Check className="h-4 w-4 text-emerald-400" />
              ) : approveState === 'preparing' ? (
                <RefreshCw className="h-4 w-4 text-primary-400 animate-spin" />
              ) : (
                <span className="text-xs font-semibold">1</span>
              )}
              <span className="text-xs font-semibold">Prepare</span>
            </div>
            <p className="text-[11px] text-surface-400 leading-snug">Precondition audit</p>
          </div>

          {/* Step 2: Awaiting Wallet */}
          <div
            className={`p-3 rounded-xl border transition ${
              approveState === 'awaiting-wallet'
                ? 'bg-primary-500/10 border-primary-500/50 text-white'
                : ['pending', 'verifying', 'confirmed'].includes(approveState)
                ? 'bg-surface-900 border-emerald-500/30 text-emerald-300'
                : approveState === 'rejected-by-user'
                ? 'bg-red-500/10 border-red-500/30 text-red-300'
                : 'bg-surface-900/50 border-surface-800 text-surface-400'
            }`}
          >
            <div className="flex items-center gap-2 mb-1">
              {['pending', 'verifying', 'confirmed'].includes(approveState) ? (
                <Check className="h-4 w-4 text-emerald-400" />
              ) : approveState === 'awaiting-wallet' ? (
                <RefreshCw className="h-4 w-4 text-primary-400 animate-spin" />
              ) : approveState === 'rejected-by-user' ? (
                <XCircle className="h-4 w-4 text-red-400" />
              ) : (
                <span className="text-xs font-semibold">2</span>
              )}
              <span className="text-xs font-semibold">MetaMask</span>
            </div>
            <p className="text-[11px] text-surface-400 leading-snug">Sign transaction</p>
          </div>

          {/* Step 3: Pending On-Chain */}
          <div
            className={`p-3 rounded-xl border transition ${
              approveState === 'pending'
                ? 'bg-primary-500/10 border-primary-500/50 text-white'
                : ['verifying', 'confirmed'].includes(approveState)
                ? 'bg-surface-900 border-emerald-500/30 text-emerald-300'
                : 'bg-surface-900/50 border-surface-800 text-surface-400'
            }`}
          >
            <div className="flex items-center gap-2 mb-1">
              {['verifying', 'confirmed'].includes(approveState) ? (
                <Check className="h-4 w-4 text-emerald-400" />
              ) : approveState === 'pending' ? (
                <RefreshCw className="h-4 w-4 text-primary-400 animate-spin" />
              ) : (
                <span className="text-xs font-semibold">3</span>
              )}
              <span className="text-xs font-semibold">Mining</span>
            </div>
            <p className="text-[11px] text-surface-400 leading-snug">Wait for block</p>
          </div>

          {/* Step 4: Verifying */}
          <div
            className={`p-3 rounded-xl border transition ${
              approveState === 'verifying'
                ? 'bg-primary-500/10 border-primary-500/50 text-white'
                : approveState === 'confirmed'
                ? 'bg-surface-900 border-emerald-500/30 text-emerald-300'
                : 'bg-surface-900/50 border-surface-800 text-surface-400'
            }`}
          >
            <div className="flex items-center gap-2 mb-1">
              {approveState === 'confirmed' ? (
                <Check className="h-4 w-4 text-emerald-400" />
              ) : approveState === 'verifying' ? (
                <RefreshCw className="h-4 w-4 text-primary-400 animate-spin" />
              ) : (
                <span className="text-xs font-semibold">4</span>
              )}
              <span className="text-xs font-semibold">Verify</span>
            </div>
            <p className="text-[11px] text-surface-400 leading-snug">Audit receipt</p>
          </div>

          {/* Step 5: Confirmed */}
          <div
            className={`p-3 rounded-xl border transition ${
              approveState === 'confirmed'
                ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-300'
                : 'bg-surface-900/50 border-surface-800 text-surface-400'
            }`}
          >
            <div className="flex items-center gap-2 mb-1">
              {approveState === 'confirmed' ? (
                <CheckCircle className="h-4 w-4 text-emerald-400" />
              ) : (
                <span className="text-xs font-semibold">5</span>
              )}
              <span className="text-xs font-semibold">Confirmed</span>
            </div>
            <p className="text-[11px] text-surface-400 leading-snug">On-chain certified</p>
          </div>
        </div>

        {/* Flow Error or Rejection Alert */}
        {flowError && (
          <Alert type="error">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-5 w-5 text-red-400 flex-shrink-0 mt-0.5" />
                <div className="text-xs space-y-1">
                  <span className="font-semibold block text-red-300">Execution Error</span>
                  <p>{flowError}</p>
                </div>
              </div>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  setFlowError(null)
                  setApproveState('idle')
                }}
              >
                Dismiss
              </Button>
            </div>
          </Alert>
        )}

        {/* In-progress Active Status Display */}
        {isActionInProgress && (
          <div className="p-4 bg-surface-900 border border-primary-500/30 rounded-xl space-y-3">
            <div className="flex items-center gap-3">
              <RefreshCw className="h-5 w-5 text-primary-400 animate-spin" />
              <div className="text-xs">
                <span className="font-semibold text-white block">
                  {approveState === 'preparing' && 'Checking preconditions on server...'}
                  {approveState === 'awaiting-wallet' && 'Awaiting transaction signature in MetaMask popup...'}
                  {approveState === 'pending' && 'Transaction broadcasted! Awaiting block confirmation...'}
                  {approveState === 'verifying' && 'Verifying on-chain transaction receipt with backend...'}
                </span>
                <span className="text-surface-400">
                  Please do not refresh or navigate away while the attestation is committing.
                </span>
              </div>
            </div>

            {activeTxHash && (
              <div className="pt-2 border-t border-surface-800 flex items-center justify-between text-xs">
                <span className="text-surface-400">Transaction Hash:</span>
                <span className="font-mono text-primary-300">{activeTxHash}</span>
              </div>
            )}
          </div>
        )}

        {/* Confirmed / Successful Attestation Results */}
        {(approveState === 'confirmed' || isFinalized) && (
          <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-5 space-y-4">
            <div className="flex items-center gap-2 text-emerald-300 font-semibold text-sm">
              <CheckCircle className="h-5 w-5 text-emerald-400" />
              <span>Document Successfully Notarized on Blockchain</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="bg-surface-950/70 p-3 rounded-lg border border-surface-800">
                <span className="text-surface-400 block mb-1">Transaction Hash</span>
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-emerald-300 truncate">
                    {notarization.transactionHash || activeTxHash}
                  </span>
                  {(notarization.transactionHash || activeTxHash) && (
                    <button
                      type="button"
                      onClick={() =>
                        handleCopy((notarization.transactionHash || activeTxHash)!, true)
                      }
                      className="p-1 hover:text-white text-surface-400 rounded transition"
                      title="Copy transaction hash"
                    >
                      {copiedTxHash ? (
                        <Check className="h-3.5 w-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="h-3.5 w-3.5" />
                      )}
                    </button>
                  )}
                </div>
              </div>

              <div className="bg-surface-950/70 p-3 rounded-lg border border-surface-800">
                <span className="text-surface-400 block mb-1">Block Number</span>
                <span className="font-mono text-white font-medium">
                  {notarization.blockNumber ? `#${notarization.blockNumber}` : 'Mined'}
                </span>
              </div>

              <div className="bg-surface-950/70 p-3 rounded-lg border border-surface-800">
                <span className="text-surface-400 block mb-1">Contract Address</span>
                <span className="font-mono text-surface-300 break-all select-all">
                  {notarization.contractAddress || 'DocumentNotary Contract'}
                </span>
              </div>

              <div className="bg-surface-950/70 p-3 rounded-lg border border-surface-800">
                <span className="text-surface-400 block mb-1">Notary Attestor Wallet</span>
                <span className="font-mono text-surface-300 break-all select-all">
                  {notarization.notaryWallet || user?.walletAddress}
                </span>
              </div>
            </div>
          </div>
        )}
      </Card>
    </div>
  )
}
