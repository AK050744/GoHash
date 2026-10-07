import React, { useState } from 'react'
import { Navbar } from '../../components/layout/Navbar'
import { Card } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Alert } from '../../components/ui/Alert'
import { Search, UploadCloud, CheckCircle2, FileCode, Shield } from 'lucide-react'

export const VerifyPage: React.FC = () => {
  const [hashInput, setHashInput] = useState('')
  const [computingHash, setComputingHash] = useState(false)
  const [fileName, setFileName] = useState<string | null>(null)
  const [verificationResult, setVerificationResult] = useState<any | null>(null)
  const [alert, setAlert] = useState<{ type: 'error' | 'info' | 'success'; message: string } | null>(null)

  // Client-side SHA-256 hash calculation using Web Crypto API
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setFileName(file.name)
    setComputingHash(true)
    setAlert(null)
    setVerificationResult(null)

    try {
      const buffer = await file.arrayBuffer()
      const hashBuffer = await crypto.subtle.digest('SHA-256', buffer)
      const hashArray = Array.from(new Uint8Array(hashBuffer))
      const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')

      setHashInput(hashHex)
      setAlert({
        type: 'info',
        message: `Computed local SHA-256 hash for "${file.name}". Click "Verify Hash" to query blockchain status.`,
      })
    } catch (err: any) {
      setAlert({
        type: 'error',
        message: `Error computing hash: ${err.message}`,
      })
    } finally {
      setComputingHash(false)
    }
  }

  const handleVerify = (e: React.FormEvent) => {
    e.preventDefault()
    const cleanHash = hashInput.trim().toLowerCase()

    if (!cleanHash) {
      setAlert({ type: 'error', message: 'Please enter a 64-character SHA-256 hexadecimal hash.' })
      return
    }

    if (!/^[a-f0-9]{64}$/.test(cleanHash)) {
      setAlert({
        type: 'error',
        message: 'Invalid SHA-256 hash format. Must be exactly 64 hexadecimal characters.',
      })
      return
    }

    // Planned Day 11 endpoint preview
    setVerificationResult({
      hash: cleanHash,
      checkedAt: new Date().toISOString(),
      status: 'PLANNED_DAY_11',
      notice: 'Smart contract query logic will be activated in Day 11 integration.',
    })
  }

  return (
    <div className="min-h-screen bg-background text-dark-100 flex flex-col">
      <Navbar />

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-12 flex-1 w-full">
        <div className="text-center max-w-2xl mx-auto mb-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-surface-secondary border border-border text-xs text-accent font-medium mb-3">
            <Shield className="w-3.5 h-3.5" />
            <span>Independent Verification</span>
          </div>
          <h1 className="text-3xl font-bold text-white font-display">Verify Document Authenticity</h1>
          <p className="text-sm text-dark-400 mt-2">
            Compute a cryptographic digest client-side or enter a 64-character SHA-256 hash to verify against the smart contract.
          </p>
        </div>

        {alert && (
          <Alert
            type={alert.type}
            message={alert.message}
            onClose={() => setAlert(null)}
            className="mb-6 max-w-2xl mx-auto"
          />
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* File Drag and Drop / Upload */}
          <Card className="flex flex-col items-center justify-center text-center p-8 border-dashed border-2 border-border hover:border-primary/50 transition-colors">
            <label className="cursor-pointer flex flex-col items-center w-full">
              <div className="w-14 h-14 rounded-2xl bg-surface-secondary border border-border flex items-center justify-center text-primary mb-4 shadow-sm">
                <UploadCloud className="w-7 h-7" />
              </div>
              <p className="text-sm font-semibold text-white">Select Document to Hash</p>
              <p className="text-xs text-dark-400 mt-1 max-w-xs">
                Processed locally in your browser. Document content never leaves your computer.
              </p>
              <input
                type="file"
                className="hidden"
                onChange={handleFileUpload}
                disabled={computingHash}
              />
              <span className="mt-4 inline-block text-xs font-semibold px-3 py-1.5 rounded-lg bg-surface-secondary border border-border text-dark-200 hover:text-white">
                {computingHash ? 'Computing SHA-256...' : fileName ? `File: ${fileName}` : 'Browse Files'}
              </span>
            </label>
          </Card>

          {/* Hash Input Form */}
          <Card className="p-8 flex flex-col justify-between">
            <div>
              <h3 className="text-base font-semibold text-white flex items-center gap-2 mb-2">
                <FileCode className="w-4 h-4 text-primary" /> Enter SHA-256 Hash
              </h3>
              <p className="text-xs text-dark-400 mb-4">
                Paste the 64-character hexadecimal digest of the document.
              </p>

              <form onSubmit={handleVerify}>
                <textarea
                  rows={3}
                  value={hashInput}
                  onChange={(e) => setHashInput(e.target.value)}
                  placeholder="e.g. e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
                  className="w-full p-3 font-mono text-xs rounded-xl bg-surface-secondary border border-border text-white placeholder-dark-500 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                />

                <Button
                  type="submit"
                  variant="primary"
                  className="w-full mt-4"
                  leftIcon={<Search className="w-4 h-4" />}
                >
                  Verify Hash
                </Button>
              </form>
            </div>
          </Card>
        </div>

        {/* Verification Result Preview */}
        {verificationResult && (
          <Card className="mt-8 p-6 bg-surface-secondary/70 border-border">
            <div className="flex items-center gap-2 text-accent font-semibold text-sm mb-3">
              <CheckCircle2 className="w-4 h-4" /> SHA-256 Digest Validated
            </div>
            <div className="font-mono text-xs space-y-1.5 text-dark-300">
              <p>
                <span className="text-dark-500">Hash:</span> {verificationResult.hash}
              </p>
              <p>
                <span className="text-dark-500">Timestamp:</span> {verificationResult.checkedAt}
              </p>
              <p className="text-dark-400 mt-2 text-[11px] italic">
                {verificationResult.notice}
              </p>
            </div>
          </Card>
        )}
      </main>
    </div>
  )
}

export default VerifyPage
