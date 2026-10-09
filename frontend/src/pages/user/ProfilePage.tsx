import { useState } from 'react'
import {
  User,
  Shield,
  Wallet,
  AlertTriangle,
  CheckCircle,
  Copy,
  Check,
  RefreshCw,
  Info,
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { useWallet } from '../../context/WalletContext'
import { api, ApiError } from '../../lib/api'
import Card from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Alert from '../../components/ui/Alert'
import type { WalletNonceResponse, WalletLinkResponse } from '../../types'

export default function ProfilePage() {
  const { user, updateUser } = useAuth()
  const {
    address,
    networkName,
    isCorrectNetwork,
    connect,
    provider,
    switchNetwork,
  } = useWallet()

  const [linking, setLinking] = useState(false)
  const [copiedLinked, setCopiedLinked] = useState(false)
  const [copiedConnected, setCopiedConnected] = useState(false)
  const [linkError, setLinkError] = useState<string | null>(null)
  const [linkSuccess, setLinkSuccess] = useState<string | null>(null)
  const [showRetry, setShowRetry] = useState(false)

  const handleCopyLinked = (addr: string) => {
    navigator.clipboard.writeText(addr)
    setCopiedLinked(true)
    setTimeout(() => setCopiedLinked(false), 2000)
  }

  const handleCopyConnected = (addr: string) => {
    navigator.clipboard.writeText(addr)
    setCopiedConnected(true)
    setTimeout(() => setCopiedConnected(false), 2000)
  }

  const handleLinkWallet = async () => {
    setLinkError(null)
    setLinkSuccess(null)
    setShowRetry(false)
    setLinking(true)

    try {
      // 1. Ensure wallet is connected
      let currentAddress = address
      let currentProvider = provider

      if (!currentAddress || !currentProvider) {
        await connect()
        // Re-read window.ethereum if needed
        if (typeof window !== 'undefined' && window.ethereum) {
          const { ethers } = await import('ethers')
          currentProvider = new ethers.BrowserProvider(window.ethereum)
          const signer = await currentProvider.getSigner()
          currentAddress = await signer.getAddress()
        }
      }

      if (!currentAddress || !currentProvider) {
        throw new Error('Please connect your MetaMask wallet before linking.')
      }

      // 2. Fetch one-time challenge nonce
      const nonceRes = await api.post<WalletNonceResponse>('/auth/wallet/nonce')
      if (!nonceRes || !nonceRes.message) {
        throw new Error('Failed to retrieve signing challenge nonce.')
      }

      // 3. Request cryptographic signature from user's wallet
      const signer = await currentProvider.getSigner()
      let signature: string
      try {
        signature = await signer.signMessage(nonceRes.message)
      } catch (signErr: unknown) {
        const ethErr = signErr as { code?: number | string; message?: string }
        if (ethErr.code === 4001 || ethErr.code === 'ACTION_REJECTED') {
          throw new Error('Message signature was rejected in MetaMask.')
        }
        throw signErr
      }

      // 4. Submit verified wallet address and signature to backend
      const linkRes = await api.patch<WalletLinkResponse>('/auth/wallet', {
        walletAddress: currentAddress,
        signature,
      })

      if (linkRes && linkRes.user) {
        updateUser(linkRes.user)
        setLinkSuccess(
          `Wallet ${currentAddress.slice(0, 6)}...${currentAddress.slice(-4)} successfully linked to your account!`
        )
      }
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        if (err.code === 'WALLET_IN_USE' || err.status === 409) {
          setLinkError('This wallet address is already linked to another GoHash account.')
        } else if (err.code === 'NONCE_INVALID' || (err.status === 400 && err.message?.toLowerCase().includes('nonce'))) {
          setLinkError('The verification nonce is invalid or has expired.')
          setShowRetry(true)
        } else if (err.code === 'SIGNATURE_INVALID' || (err.status === 400 && err.message?.toLowerCase().includes('signature'))) {
          setLinkError('Signature verification failed. The recovered address does not match your wallet.')
          setShowRetry(true)
        } else {
          setLinkError(err.message || 'Failed to link wallet.')
        }
      } else if (err instanceof Error) {
        setLinkError(err.message)
      } else {
        setLinkError('An unexpected error occurred during wallet linking.')
      }
    } finally {
      setLinking(false)
    }
  }

  const linkedAddress = user?.walletAddress
  const isMismatch =
    Boolean(linkedAddress && address && linkedAddress.toLowerCase() !== address.toLowerCase())

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight">Account Profile</h1>
        <p className="text-surface-400 text-sm mt-1">
          Manage your identity and cryptographic wallet association.
        </p>
      </div>

      {/* Notifications */}
      {linkSuccess && (
        <Alert type="success">
          <div className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 flex-shrink-0" />
            <span>{linkSuccess}</span>
          </div>
        </Alert>
      )}

      {linkError && (
        <Alert type="error">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 flex-shrink-0" />
              <span>{linkError}</span>
            </div>
            {showRetry && (
              <Button size="sm" variant="secondary" onClick={handleLinkWallet}>
                <RefreshCw className="h-3.5 w-3.5" />
                <span>Retry Linking</span>
              </Button>
            )}
          </div>
        </Alert>
      )}

      {/* Account Info Card */}
      <Card className="space-y-6">
        <div className="flex items-center gap-3 border-b border-surface-700/80 pb-4">
          <div className="h-10 w-10 rounded-xl bg-surface-900 border border-surface-700 flex items-center justify-center text-primary-400">
            <User className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white">Personal Information</h2>
            <p className="text-xs text-surface-400">Basic details of your GoHash account</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-surface-900 border border-surface-800 rounded-xl p-4">
            <span className="text-xs text-surface-400 block mb-1">Full Name</span>
            <span className="text-sm font-medium text-white">{user?.name || '—'}</span>
          </div>

          <div className="bg-surface-900 border border-surface-800 rounded-xl p-4">
            <span className="text-xs text-surface-400 block mb-1">Email Address</span>
            <span className="text-sm font-medium text-white">{user?.email || '—'}</span>
          </div>

          <div className="bg-surface-900 border border-surface-800 rounded-xl p-4">
            <span className="text-xs text-surface-400 block mb-1">System Role</span>
            <span className="inline-block text-xs font-semibold px-2.5 py-1 rounded-full bg-primary-600/20 text-primary-300 border border-primary-500/30">
              {user?.role}
            </span>
          </div>
        </div>
      </Card>

      {/* Blockchain Wallet Association Card */}
      <Card className="space-y-6">
        <div className="flex items-center justify-between border-b border-surface-700/80 pb-4 flex-wrap gap-2">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-surface-900 border border-surface-700 flex items-center justify-center text-primary-400">
              <Shield className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Blockchain Wallet Association</h2>
              <p className="text-xs text-surface-400">
                Cryptographic address used for on-chain attestations and ownership verification
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {linkedAddress ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                <CheckCircle className="h-3.5 w-3.5 text-emerald-400" />
                <span>Linked ({linkedAddress.slice(0, 6)}...{linkedAddress.slice(-4)})</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-amber-500/10 text-amber-300 border border-amber-500/20">
                <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />
                <span>No Wallet Linked</span>
              </span>
            )}
          </div>
        </div>

        {/* Mismatch Warning */}
        {isMismatch && (
          <Alert type="warning">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-400 flex-shrink-0 mt-0.5" />
              <div className="text-xs leading-relaxed space-y-1">
                <span className="font-semibold block text-amber-200">
                  Account Mismatch Detected
                </span>
                <span>
                  Your currently connected MetaMask account{' '}
                  <span className="font-mono text-amber-300">
                    {address?.slice(0, 6)}...{address?.slice(-4)}
                  </span>{' '}
                  differs from your linked account{' '}
                  <span className="font-mono text-amber-300">
                    {linkedAddress?.slice(0, 6)}...{linkedAddress?.slice(-4)}
                  </span>
                  . Please switch accounts in MetaMask to match your registered wallet, or update your linked wallet below.
                </span>
              </div>
            </div>
          </Alert>
        )}

        {/* Linked Wallet Details */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Registered / Linked Address */}
          <div className="bg-surface-900 border border-surface-800 rounded-xl p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-surface-400">Linked Account Wallet</span>
              {linkedAddress && (
                <button
                  type="button"
                  onClick={() => handleCopyLinked(linkedAddress)}
                  className="inline-flex items-center gap-1 text-xs text-primary-400 hover:text-primary-300"
                >
                  {copiedLinked ? (
                    <>
                      <Check className="h-3 w-3 text-emerald-400" />
                      <span className="text-emerald-400">Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-3 w-3" />
                      <span>Copy</span>
                    </>
                  )}
                </button>
              )}
            </div>
            {linkedAddress ? (
              <div className="bg-surface-950 p-2.5 rounded-lg border border-surface-800 font-mono text-xs text-primary-300 break-all select-all">
                {linkedAddress}
              </div>
            ) : (
              <p className="text-xs text-surface-500 italic py-2">
                No wallet address has been linked to this account yet.
              </p>
            )}
          </div>

          {/* Currently Connected MetaMask */}
          <div className="bg-surface-900 border border-surface-800 rounded-xl p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-surface-400">Connected MetaMask Account</span>
              {address && (
                <button
                  type="button"
                  onClick={() => handleCopyConnected(address)}
                  className="inline-flex items-center gap-1 text-xs text-primary-400 hover:text-primary-300"
                >
                  {copiedConnected ? (
                    <>
                      <Check className="h-3 w-3 text-emerald-400" />
                      <span className="text-emerald-400">Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-3 w-3" />
                      <span>Copy</span>
                    </>
                  )}
                </button>
              )}
            </div>
            {address ? (
              <div className="space-y-1.5">
                <div className="bg-surface-950 p-2.5 rounded-lg border border-surface-800 font-mono text-xs text-surface-200 break-all select-all">
                  {address}
                </div>
                <div className="flex items-center justify-between text-xs text-surface-400 pt-0.5">
                  <span>Network:</span>
                  <span className={isCorrectNetwork ? 'text-emerald-400 font-medium' : 'text-amber-400 font-medium'}>
                    {networkName || 'Unknown Network'}
                  </span>
                </div>
              </div>
            ) : (
              <div className="py-2 flex items-center justify-between">
                <span className="text-xs text-surface-500 italic">MetaMask not connected</span>
                <Button size="sm" variant="ghost" onClick={connect}>
                  <Wallet className="h-3.5 w-3.5" />
                  <span>Connect</span>
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Security & Gas-Free Explanation Banner */}
        <div className="bg-surface-900/60 border border-surface-700/80 rounded-xl p-4 flex items-start gap-3">
          <Info className="h-5 w-5 text-primary-400 flex-shrink-0 mt-0.5" />
          <div className="text-xs text-surface-300 space-y-1">
            <span className="font-semibold text-white block">Gas-Free Cryptographic Proof</span>
            <p>
              Signing this message is free. It does not send a transaction and GoHash never sees your private key.
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-4">
          {!isCorrectNetwork && address && (
            <Button variant="secondary" size="sm" onClick={switchNetwork}>
              <RefreshCw className="h-3.5 w-3.5" />
              <span>Switch Network</span>
            </Button>
          )}

          <div className="ml-auto">
            <Button
              variant="primary"
              loading={linking}
              onClick={handleLinkWallet}
              className="w-full sm:w-auto"
            >
              <Wallet className="h-4 w-4" />
              <span>{linkedAddress ? 'Update Linked Wallet' : 'Link MetaMask Wallet'}</span>
            </Button>
          </div>
        </div>
      </Card>
    </div>
  )
}
