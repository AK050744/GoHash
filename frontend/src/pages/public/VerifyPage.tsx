import { useState, useRef, DragEvent, ChangeEvent } from 'react'
import {
  Shield,
  Upload,
  FileText,
  CheckCircle2,
  XCircle,
  Copy,
  Check,
  AlertTriangle,
  RotateCcw,
  Clock,
} from 'lucide-react'
import Card from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Alert from '../../components/ui/Alert'
import Spinner from '../../components/ui/Spinner'
import { api, ApiError } from '../../lib/api'
import type { VerifyResponse } from '../../types'

export default function VerifyPage() {
  const [file, setFile] = useState<File | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [result, setResult] = useState<VerifyResponse | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [copiedHash, setCopiedHash] = useState(false)
  const [copiedTx, setCopiedTx] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)

  const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024 // 10 MB

  const validateFile = (selectedFile: File): string | null => {
    const isPdfMime = selectedFile.type === 'application/pdf'
    const isPdfExt = selectedFile.name.toLowerCase().endsWith('.pdf')
    if (!isPdfMime && !isPdfExt) {
      return 'Not a valid PDF. Please select a PDF document.'
    }
    if (selectedFile.size > MAX_FILE_SIZE_BYTES) {
      return 'File size exceeds the limit of 10 MB.'
    }
    return null
  }

  const handleFileSelection = (selectedFile: File) => {
    setErrorMessage(null)
    setResult(null)

    const validationError = validateFile(selectedFile)
    if (validationError) {
      setErrorMessage(validationError)
      setFile(null)
      return
    }

    setFile(selectedFile)
  }

  const onDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const onDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(false)
  }

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(false)
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileSelection(e.dataTransfer.files[0])
    }
  }

  const onFileInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFileSelection(e.target.files[0])
    }
  }

  const handleVerify = async () => {
    if (!file) return

    setVerifying(true)
    setErrorMessage(null)
    setResult(null)

    try {
      const res = await api.upload<VerifyResponse>(file, undefined, '/verify')
      setResult(res)
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        if (err.status === 429 || err.code === 'RATE_LIMITED') {
          setErrorMessage('Too many verification attempts. Wait a minute and try again.')
        } else if (err.code === 'INVALID_FILE') {
          setErrorMessage('Not a valid PDF.')
        } else if (err.code === 'FILE_TOO_LARGE') {
          setErrorMessage('File size exceeds the limit of 10 MB.')
        } else if (err.code === 'CHAIN_UNREACHABLE' || err.code === 'CONTRACT_NOT_DEPLOYED') {
          setErrorMessage(
            'The blockchain could not be read, so the result is unknown. This is NOT a verification failure.'
          )
        } else if (err.code === 'NETWORK_ERROR') {
          setErrorMessage('Network connection error during verification. Check your connection and try again.')
        } else {
          setErrorMessage(err.message || 'Verification failed unexpectedly.')
        }
      } else if (err instanceof Error) {
        setErrorMessage(err.message)
      } else {
        setErrorMessage('An unexpected error occurred while verifying the file.')
      }
    } finally {
      setVerifying(false)
    }
  }

  const handleReset = () => {
    setFile(null)
    setResult(null)
    setErrorMessage(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
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

  const formatTimestamp = (unixSeconds: number) => {
    return new Date(unixSeconds * 1000).toLocaleString(undefined, {
      dateStyle: 'medium',
      timeStyle: 'medium',
    })
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 sm:py-12">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="inline-flex p-3 rounded-2xl bg-primary-500/10 text-primary-400 mb-4 border border-primary-500/20">
          <Shield className="w-8 h-8" />
        </div>
        <h1 className="text-3xl font-extrabold text-white tracking-tight sm:text-4xl">
          Public Document Verification
        </h1>
        <p className="mt-3 text-base text-surface-400 max-w-xl mx-auto">
          Verify the tamper-evident authenticity of any PDF file directly against the blockchain.
          The file is analyzed in-memory and never stored.
        </p>
      </div>

      {/* Main Container */}
      <Card className="p-6 sm:p-8">
        {/* Error message */}
        {errorMessage && (
          <div className="mb-6">
            <Alert type="error">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5 text-red-400" />
                <span>{errorMessage}</span>
              </div>
            </Alert>
          </div>
        )}

        {/* Verification Result Section with aria-live */}
        <div aria-live="polite" aria-atomic="true">
          {result && (
            <div className="mb-8">
              {result.status === 'VERIFIED' ? (
                /* ── VERIFIED RESULT ── */
                <div
                  id="verification-result-panel"
                  className="rounded-2xl border border-emerald-500/30 bg-emerald-950/20 p-6 sm:p-8"
                >
                  <div className="flex items-center gap-4 mb-6">
                    <div className="p-3 bg-emerald-500/20 text-emerald-400 rounded-2xl border border-emerald-500/40">
                      <CheckCircle2 className="w-8 h-8" aria-hidden="true" />
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold text-emerald-400 tracking-tight flex items-center gap-2">
                        <span>VERIFIED</span>
                        <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-medium">
                          Independently Verifiable
                        </span>
                      </h2>
                      <p className="text-sm text-surface-300 mt-1">
                        The cryptographic SHA-256 hash of this file matches an authorized on-chain notarization record.
                      </p>
                    </div>
                  </div>

                  {/* Verification Details */}
                  <div className="space-y-4 pt-4 border-t border-emerald-500/20">
                    {/* File / Doc info if returned */}
                    {(result.document?.originalName || result.document?.id) && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-surface-900/60 p-4 rounded-xl border border-surface-800">
                        {result.document?.originalName && (
                          <div>
                            <span className="text-xs font-semibold text-surface-400 uppercase tracking-wider">
                              Original File Name
                            </span>
                            <p className="text-sm font-medium text-white mt-1 break-all flex items-center gap-1.5">
                              <FileText className="w-4 h-4 text-primary-400 flex-shrink-0" />
                              {result.document.originalName}
                            </p>
                          </div>
                        )}
                        {result.document?.id && (
                          <div>
                            <span className="text-xs font-semibold text-surface-400 uppercase tracking-wider">
                              Document ID
                            </span>
                            <p className="text-sm font-mono text-surface-300 mt-1 break-all">
                              {result.document.id}
                            </p>
                          </div>
                        )}
                      </div>
                    )}

                    {/* SHA-256 Digest */}
                    <div className="bg-surface-900/60 p-4 rounded-xl border border-surface-800">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-semibold text-surface-400 uppercase tracking-wider">
                          Cryptographic SHA-256 Hash
                        </span>
                        <button
                          type="button"
                          onClick={() => handleCopyHash(result.hash)}
                          className="text-xs text-primary-400 hover:text-primary-300 flex items-center gap-1 transition"
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
                      <p className="font-mono text-xs sm:text-sm text-surface-200 break-all bg-surface-950/80 p-2.5 rounded-lg border border-surface-800/80">
                        {result.hash}
                      </p>
                    </div>

                    {/* On-Chain Record Details */}
                    {result.record && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {/* Timestamp */}
                        <div className="bg-surface-900/60 p-4 rounded-xl border border-surface-800 sm:col-span-2">
                          <div className="flex items-start gap-2.5">
                            <Clock className="w-5 h-5 text-emerald-400 mt-0.5 flex-shrink-0" />
                            <div>
                              <span className="text-xs font-semibold text-surface-400 uppercase tracking-wider">
                                On-Chain Registration Timestamp
                              </span>
                              <p className="text-base font-semibold text-white mt-1">
                                Recorded on-chain at {formatTimestamp(result.record.timestamp)}
                              </p>
                              <p className="text-xs text-surface-400 mt-1">
                                Note: This timestamp proves that the document hash was recorded no later than this time.
                              </p>
                            </div>
                          </div>
                        </div>

                        {/* Notary Wallet */}
                        <div className="bg-surface-900/60 p-4 rounded-xl border border-surface-800">
                          <span className="text-xs font-semibold text-surface-400 uppercase tracking-wider">
                            Attesting Notary Wallet
                          </span>
                          <p className="font-mono text-xs text-surface-200 mt-1 break-all">
                            {result.record.notaryWallet}
                          </p>
                        </div>

                        {/* Contract Address */}
                        <div className="bg-surface-900/60 p-4 rounded-xl border border-surface-800">
                          <span className="text-xs font-semibold text-surface-400 uppercase tracking-wider">
                            Smart Contract Address
                          </span>
                          <p className="font-mono text-xs text-surface-200 mt-1 break-all">
                            {result.record.contractAddress}
                          </p>
                        </div>

                        {/* Transaction Hash */}
                        {result.record.transactionHash && (
                          <div className="bg-surface-900/60 p-4 rounded-xl border border-surface-800">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs font-semibold text-surface-400 uppercase tracking-wider">
                                Transaction Hash
                              </span>
                              <button
                                type="button"
                                onClick={() => handleCopyTx(result.record!.transactionHash!)}
                                className="text-xs text-primary-400 hover:text-primary-300 flex items-center gap-1 transition"
                                title="Copy transaction hash"
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
                            </div>
                            <p className="font-mono text-xs text-surface-200 break-all">
                              {result.record.transactionHash}
                            </p>
                          </div>
                        )}

                        {/* Block Number */}
                        {result.record.blockNumber !== undefined && result.record.blockNumber !== null && (
                          <div className="bg-surface-900/60 p-4 rounded-xl border border-surface-800">
                            <span className="text-xs font-semibold text-surface-400 uppercase tracking-wider">
                              Block Number
                            </span>
                            <p className="text-sm font-semibold text-white mt-1">
                              #{result.record.blockNumber}
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Reset Button */}
                  <div className="mt-6 pt-4 border-t border-emerald-500/20 text-center">
                    <Button
                      variant="secondary"
                      onClick={handleReset}
                      className="inline-flex items-center gap-2"
                    >
                      <RotateCcw className="w-4 h-4" />
                      Verify another file
                    </Button>
                  </div>
                </div>
              ) : (
                /* ── NOT_VERIFIED RESULT ── */
                <div
                  id="verification-result-panel"
                  className="rounded-2xl border border-red-500/30 bg-red-950/20 p-6 sm:p-8"
                >
                  <div className="flex items-center gap-4 mb-6">
                    <div className="p-3 bg-red-500/20 text-red-400 rounded-2xl border border-red-500/40">
                      <XCircle className="w-8 h-8" aria-hidden="true" />
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold text-red-400 tracking-tight">
                        TAMPERED / VERIFICATION FAILED
                      </h2>
                      <p className="text-sm text-surface-300 mt-1">
                        This file does not match any notarized record. It may have been modified after
                        notarization, or it may never have been notarized.
                      </p>
                    </div>
                  </div>

                  {/* Computed Hash Display */}
                  <div className="bg-surface-900/60 p-4 rounded-xl border border-surface-800 mb-6">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-semibold text-surface-400 uppercase tracking-wider">
                        Computed SHA-256 Digest of Uploaded File
                      </span>
                      <button
                        type="button"
                        onClick={() => handleCopyHash(result.hash)}
                        className="text-xs text-primary-400 hover:text-primary-300 flex items-center gap-1 transition"
                        title="Copy computed hash"
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
                    <p className="font-mono text-xs sm:text-sm text-surface-200 break-all bg-surface-950/80 p-2.5 rounded-lg border border-surface-800/80">
                      {result.hash}
                    </p>
                  </div>

                  {/* Reset Button */}
                  <div className="text-center pt-2">
                    <Button
                      variant="secondary"
                      onClick={handleReset}
                      className="inline-flex items-center gap-2"
                    >
                      <RotateCcw className="w-4 h-4" />
                      Verify another file
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* File Picker / Dropzone (Shown when no result yet) */}
        {!result && (
          <div>
            <div
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
              onDrop={onDrop}
              onClick={() => !verifying && fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-2xl p-8 sm:p-12 text-center cursor-pointer transition-all ${
                isDragging
                  ? 'border-primary-400 bg-primary-500/10 scale-[1.01]'
                  : 'border-surface-700 hover:border-surface-600 bg-surface-900/40 hover:bg-surface-900/60'
              } ${verifying ? 'opacity-50 pointer-events-none' : ''}`}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if ((e.key === 'Enter' || e.key === ' ') && !verifying) {
                  fileInputRef.current?.click()
                }
              }}
              aria-label="Upload PDF document to verify"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,application/pdf"
                onChange={onFileInputChange}
                className="hidden"
                disabled={verifying}
              />

              <div className="flex flex-col items-center">
                <div className="p-4 rounded-2xl bg-surface-800/80 text-surface-300 mb-4 shadow-sm border border-surface-700/60">
                  <Upload className="w-8 h-8 text-primary-400" />
                </div>

                <p className="text-base font-semibold text-white">
                  {file ? file.name : 'Choose a file or drag and drop here'}
                </p>
                <p className="text-xs text-surface-400 mt-1">
                  PDF format only • Maximum file size: 10 MB
                </p>

                {file && (
                  <div className="mt-4 px-3 py-1.5 rounded-lg bg-surface-800/90 border border-surface-700 text-xs text-surface-300 flex items-center gap-2">
                    <FileText className="w-3.5 h-3.5 text-primary-400" />
                    <span>{(file.size / (1024 * 1024)).toFixed(2)} MB</span>
                  </div>
                )}
              </div>
            </div>

            {/* Action buttons */}
            <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
              <p className="text-xs text-surface-500">
                Privacy guarantee: Files are processed strictly in-memory and never saved to any server disk.
              </p>

              <div className="flex items-center gap-3 w-full sm:w-auto">
                {file && (
                  <Button
                    variant="secondary"
                    onClick={handleReset}
                    disabled={verifying}
                    className="w-full sm:w-auto"
                  >
                    Clear
                  </Button>
                )}

                <Button
                  variant="primary"
                  onClick={handleVerify}
                  disabled={!file || verifying}
                  className="w-full sm:w-auto min-w-[140px] flex items-center justify-center gap-2"
                >
                  {verifying ? (
                    <>
                      <Spinner size="sm" />
                      <span>Verifying...</span>
                    </>
                  ) : (
                    <>
                      <Shield className="w-4 h-4" />
                      <span>Verify File</span>
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        )}
      </Card>
    </div>
  )
}
