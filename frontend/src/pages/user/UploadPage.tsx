import { useState, useRef, DragEvent, ChangeEvent } from 'react'
import { Link } from 'react-router-dom'
import {
  Upload,
  FileText,
  CheckCircle,
  Copy,
  Check,
  AlertCircle,
  ArrowRight,
  RefreshCw,
  X,
} from 'lucide-react'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import Alert from '../../components/ui/Alert'
import StatusBadge from '../../components/ui/StatusBadge'
import { upload, ApiError } from '../../lib/api'
import type { DocumentStatus, DocumentUploadResponse } from '../../types'

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10 MB

export default function UploadPage() {
  const [file, setFile] = useState<File | null>(null)
  const [isDragOver, setIsDragOver] = useState(false)
  const [validationError, setValidationError] = useState<string | null>(null)
  const [apiError, setApiError] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [uploadedDoc, setUploadedDoc] = useState<DocumentUploadResponse['document'] | null>(null)
  const [copied, setCopied] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)

  const validateAndSetFile = (selected: File) => {
    setValidationError(null)
    setApiError(null)

    const isPdfExt = selected.name.toLowerCase().endsWith('.pdf')
    const isPdfType = selected.type === 'application/pdf' || selected.type === ''

    if (!isPdfExt && !isPdfType) {
      setValidationError('Not a valid PDF. Please upload a file with the .pdf extension.')
      setFile(null)
      return
    }

    if (selected.size > MAX_FILE_SIZE) {
      setValidationError('File exceeds 10 MB. Please choose a smaller document.')
      setFile(null)
      return
    }

    setFile(selected)
  }

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragOver(true)
  }

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragOver(false)
  }

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragOver(false)
    if (uploading) return

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      validateAndSetFile(e.dataTransfer.files[0])
    }
  }

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      validateAndSetFile(e.target.files[0])
    }
  }

  const handleUpload = async () => {
    if (!file || uploading) return
    setUploading(true)
    setProgress(0)
    setApiError(null)

    try {
      const res = await upload<DocumentUploadResponse>(file, (percent) => {
        setProgress(percent)
      })

      if (res && res.document) {
        setUploadedDoc(res.document)
      } else {
        throw new Error('Invalid response structure received from server')
      }
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        if (err.code === 'INVALID_FILE') {
          setApiError('Not a valid PDF')
        } else if (err.code === 'FILE_TOO_LARGE') {
          setApiError('File exceeds 10 MB')
        } else if (err.code === 'DUPLICATE_DOCUMENT') {
          setApiError('You have already uploaded this exact file')
        } else {
          setApiError(err.message || 'Upload failed')
        }
      } else if (err instanceof Error) {
        setApiError(err.message)
      } else {
        setApiError('An unexpected error occurred while uploading.')
      }
    } finally {
      setUploading(false)
    }
  }

  const handleReset = () => {
    setFile(null)
    setValidationError(null)
    setApiError(null)
    setProgress(0)
    setUploadedDoc(null)
    setCopied(false)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleCopy = (hash: string) => {
    navigator.clipboard.writeText(hash)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Upload Document</h1>
        <p className="text-surface-400 mt-1">
          Upload a PDF to compute its cryptographic SHA-256 fingerprint on the server and prepare it for notarization.
        </p>
      </div>

      {/* Success State */}
      {uploadedDoc ? (
        <Card className="border-green-500/30 bg-green-950/10 space-y-6 p-6">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-green-500/20 text-green-400 flex items-center justify-center flex-shrink-0">
              <CheckCircle className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Document Uploaded Successfully</h2>
              <p className="text-sm text-surface-400">
                The document has been securely stored and its SHA-256 hash registered.
              </p>
            </div>
          </div>

          <div className="bg-surface-900 border border-surface-700/80 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-primary-400" />
                <span className="text-sm font-medium text-white">{uploadedDoc.originalName}</span>
              </div>
              <StatusBadge status={uploadedDoc.status as DocumentStatus} />
            </div>

            <div>
              <label className="text-xs text-surface-400 font-mono uppercase tracking-wider block mb-1">
                Server Computed SHA-256 Hash
              </label>
              <div className="flex items-center gap-2 bg-surface-950 px-3 py-2 rounded-lg border border-surface-800">
                <code className="text-xs font-mono text-primary-300 break-all flex-1 select-all">
                  {uploadedDoc.sha256Hash}
                </code>
                <button
                  type="button"
                  onClick={() => handleCopy(uploadedDoc.sha256Hash)}
                  className="p-1.5 text-surface-400 hover:text-white rounded hover:bg-surface-800 transition"
                  title="Copy SHA-256 hash"
                >
                  {copied ? <Check className="h-4 w-4 text-green-400" /> : <Copy className="h-4 w-4" />}
                </button>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between pt-2">
            <Button variant="secondary" onClick={handleReset}>
              <RefreshCw className="h-4 w-4" /> Upload another
            </Button>
            <Link to={`/documents/${uploadedDoc.id}`}>
              <Button variant="primary">
                View document <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </Card>
      ) : (
        /* Upload Form */
        <Card className="space-y-6">
          {validationError && (
            <Alert type="warning">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                <span>{validationError}</span>
              </div>
            </Alert>
          )}

          {apiError && (
            <Alert type="error">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                <span>{apiError}</span>
              </div>
            </Alert>
          )}

          {/* Drag & Drop Area */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => !uploading && fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-2xl p-8 sm:p-12 text-center cursor-pointer transition-all duration-200 ${
              isDragOver
                ? 'border-primary-500 bg-primary-500/10'
                : 'border-surface-700 hover:border-surface-600 bg-surface-900/50 hover:bg-surface-900'
            } ${uploading ? 'pointer-events-none opacity-60' : ''}`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,application/pdf"
              onChange={handleFileChange}
              className="hidden"
              disabled={uploading}
            />

            <div className="mx-auto h-14 w-14 rounded-full bg-surface-800 border border-surface-700 flex items-center justify-center text-primary-400 mb-4">
              <Upload className="h-7 w-7" />
            </div>

            <p className="text-base font-semibold text-white">
              Click to select or drag and drop your PDF here
            </p>
            <p className="text-sm text-surface-400 mt-1">
              Supports PDF documents only (up to 10 MB)
            </p>
          </div>

          {/* Selected File Details */}
          {file && (
            <div className="bg-surface-900 border border-surface-700 rounded-xl p-4 flex items-center justify-between">
              <div className="flex items-center gap-3 min-w-0">
                <div className="h-10 w-10 rounded-lg bg-surface-800 flex items-center justify-center text-primary-400 flex-shrink-0">
                  <FileText className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-white truncate">{file.name}</p>
                  <p className="text-xs text-surface-400">{formatFileSize(file.size)}</p>
                </div>
              </div>
              {!uploading && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    setFile(null)
                    if (fileInputRef.current) fileInputRef.current.value = ''
                  }}
                  className="text-surface-400 hover:text-white p-1 rounded-lg hover:bg-surface-800 transition"
                  title="Remove file"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          )}

          {/* Progress Bar */}
          {uploading && (
            <div className="space-y-2">
              <div className="flex justify-between text-xs font-medium text-surface-400">
                <span>Uploading and hashing on server...</span>
                <span>{progress}%</span>
              </div>
              <div className="h-2 w-full bg-surface-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary-500 rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end pt-2">
            <Button
              type="button"
              variant="primary"
              disabled={!file || uploading}
              loading={uploading}
              onClick={handleUpload}
            >
              <Upload className="h-4 w-4" />
              {uploading ? `Uploading (${progress}%)` : 'Upload and Register'}
            </Button>
          </div>
        </Card>
      )}
    </div>
  )
}
