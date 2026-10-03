import { useState, FormEvent } from 'react'
import { documentService } from '../services/document.service'
import { hashFile } from '../services/web3.service'
import { VerificationResult } from '../types'
import styles from './VerifyPage.module.css'

export default function VerifyPage() {
  const [mode,    setMode]    = useState<'hash' | 'file'>('file')
  const [hash,    setHash]    = useState('')
  const [result,  setResult]  = useState<VerificationResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setLoading(true)
    try {
      const h = await hashFile(file)
      setHash(h)
    } finally {
      setLoading(false)
    }
  }

  async function handleVerify(e: FormEvent) {
    e.preventDefault()
    if (!hash) return
    setLoading(true)
    setError('')
    setResult(null)
    try {
      const res = await documentService.verify(hash.startsWith('0x') ? hash : `0x${hash}`)
      setResult(res)
    } catch (err: any) {
      if (err.response?.status === 404) {
        setResult({ verified: false })
      } else {
        setError(err.response?.data?.message || 'Verification failed')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container">
      <div className={styles.page}>
        <h1 className={styles.title}>Verify a Document</h1>
        <p className={styles.subtitle}>
          Check if a document has been notarized on the blockchain.
        </p>

        <div className={`glass-card ${styles.card}`}>
          {/* Mode toggle */}
          <div className={styles.tabs}>
            <button
              className={`${styles.tab} ${mode === 'file' ? styles.active : ''}`}
              onClick={() => setMode('file')}
            >
              Upload File
            </button>
            <button
              className={`${styles.tab} ${mode === 'hash' ? styles.active : ''}`}
              onClick={() => setMode('hash')}
            >
              Enter Hash
            </button>
          </div>

          <form onSubmit={handleVerify} className={styles.form}>
            {mode === 'file' ? (
              <div className="form-group">
                <label className="form-label">Select File to Verify</label>
                <input
                  id="verify-file"
                  type="file"
                  className="form-input"
                  onChange={handleFileChange}
                />
                {hash && (
                  <p className={styles.computedHash}>
                    Computed hash: <code>{hash.slice(0, 24)}…</code>
                  </p>
                )}
              </div>
            ) : (
              <div className="form-group">
                <label className="form-label">Document Hash (hex)</label>
                <input
                  id="verify-hash-input"
                  type="text"
                  className="form-input"
                  value={hash}
                  onChange={(e) => setHash(e.target.value)}
                  placeholder="0xabc123… or abc123…"
                />
              </div>
            )}

            <button type="submit" className="btn btn-primary" disabled={loading || !hash}>
              {loading ? 'Verifying…' : 'Verify on Blockchain'}
            </button>
          </form>

          {error && <div className={styles.error}>{error}</div>}

          {result && (
            <div className={`${styles.result} ${result.verified ? styles.verified : styles.notVerified}`}>
              {result.verified ? (
                <>
                  <span className={styles.resultIcon}>✅</span>
                  <div>
                    <p className={styles.resultTitle}>Document is Notarized</p>
                    <p>Owner: <code>{result.onChain?.owner}</code></p>
                    <p>Notarized: {result.onChain?.notarizedAt}</p>
                    {result.onChain?.description && <p>Description: {result.onChain.description}</p>}
                  </div>
                </>
              ) : (
                <>
                  <span className={styles.resultIcon}>❌</span>
                  <div>
                    <p className={styles.resultTitle}>Not Found on Blockchain</p>
                    <p className={styles.resultSub}>This document has not been notarized yet.</p>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
