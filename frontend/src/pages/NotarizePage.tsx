import { useState, useRef, DragEvent, ChangeEvent, FormEvent } from 'react'
import { documentService } from '../services/document.service'
import { hashFile } from '../services/web3.service'
import styles from './NotarizePage.module.css'

type Step = 'upload' | 'confirm' | 'done'

export default function NotarizePage() {
  const [step,        setStep]        = useState<Step>('upload')
  const [file,        setFile]        = useState<File | null>(null)
  const [hash,        setHash]        = useState('')
  const [description, setDescription] = useState('')
  const [result,      setResult]      = useState<any>(null)
  const [loading,     setLoading]     = useState(false)
  const [error,       setError]       = useState('')
  const [isDragging,  setIsDragging]  = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  async function handleFileSelect(selected: File) {
    setFile(selected)
    setLoading(true)
    try {
      const h = await hashFile(selected)
      setHash(h)
      setStep('confirm')
    } catch {
      setError('Failed to hash file')
    } finally {
      setLoading(false)
    }
  }

  function onDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setIsDragging(false)
    const f = e.dataTransfer.files[0]
    if (f) handleFileSelect(f)
  }

  function onFileInput(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (f) handleFileSelect(f)
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!file || !hash) return
    setLoading(true)
    setError('')
    try {
      const res = await documentService.notarize({
        documentHash: `0x${hash}`,
        description,
        fileName: file.name,
        mimeType: file.type || 'application/octet-stream',
        fileSize: file.size,
      })
      setResult(res)
      setStep('done')
    } catch (err: any) {
      setError(err.response?.data?.message || 'Notarization failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container">
      <div className={styles.page}>
        <h1 className={styles.title}>Notarize a Document</h1>
        <p className={styles.subtitle}>
          Your file is hashed locally — it never leaves your browser.
        </p>

        {/* Step: Upload */}
        {step === 'upload' && (
          <div
            className={`glass-card ${styles.dropzone} ${isDragging ? styles.dragging : ''}`}
            onDrop={onDrop}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
            onDragLeave={() => setIsDragging(false)}
            onClick={() => inputRef.current?.click()}
          >
            <span className={styles.dropIcon}>📂</span>
            <p className={styles.dropText}>Drag & drop a file here, or click to select</p>
            <p className={styles.dropHint}>Any file type accepted</p>
            <input
              ref={inputRef}
              type="file"
              style={{ display: 'none' }}
              onChange={onFileInput}
            />
            {loading && <p className={styles.hashing}>Computing SHA-256…</p>}
          </div>
        )}

        {/* Step: Confirm */}
        {step === 'confirm' && file && (
          <div className={`glass-card ${styles.confirmCard}`}>
            <div className={styles.fileInfo}>
              <span className={styles.fileIcon}>📄</span>
              <div>
                <p className={styles.fileName}>{file.name}</p>
                <p className={styles.fileSize}>{(file.size / 1024).toFixed(1)} KB</p>
              </div>
            </div>
            <div className={styles.hashBox}>
              <span className={styles.hashLabel}>SHA-256 Hash</span>
              <code className={styles.hashValue}>{hash}</code>
            </div>

            {error && <div className={styles.error}>{error}</div>}

            <form onSubmit={onSubmit} className={styles.form}>
              <div className="form-group">
                <label className="form-label">Description (optional)</label>
                <input
                  id="notarize-description"
                  type="text"
                  className="form-input"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="e.g. Employment contract — Q4 2026"
                />
              </div>
              <div className={styles.actions}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => { setStep('upload'); setFile(null); setHash('') }}
                >
                  ← Choose different file
                </button>
                <button type="submit" className="btn btn-primary" disabled={loading}>
                  {loading ? 'Notarizing…' : 'Notarize on Blockchain ⛓️'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Step: Done */}
        {step === 'done' && result && (
          <div className={`glass-card ${styles.successCard}`}>
            <span className={styles.successIcon}>✅</span>
            <h2>Document Notarized!</h2>
            <p className={styles.successSub}>Your document is now permanently recorded on the blockchain.</p>
            <div className={styles.txInfo}>
              <div className={styles.txRow}>
                <span>Transaction Hash</span>
                <code>{result.tx?.hash}</code>
              </div>
              <div className={styles.txRow}>
                <span>Block Number</span>
                <code>{result.tx?.blockNumber}</code>
              </div>
            </div>
            <button
              className="btn btn-secondary"
              onClick={() => { setStep('upload'); setFile(null); setHash(''); setResult(null) }}
            >
              Notarize Another Document
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
