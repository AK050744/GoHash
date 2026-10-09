import { useState, useRef, useEffect } from 'react'
import {
  Wallet,
  AlertTriangle,
  ChevronDown,
  Copy,
  Check,
  LogOut,
  RefreshCw,
  ExternalLink,
} from 'lucide-react'
import { useWallet } from '../../context/WalletContext'
import Button from '../ui/Button'
import { EXPECTED_CHAIN_NAME } from '../../lib/env'

export default function WalletButton() {
  const {
    address,
    networkName,
    isCorrectNetwork,
    isConnecting,
    error,
    isMetaMaskInstalled,
    connect,
    disconnect,
    switchNetwork,
    clearError,
  } = useWallet()

  const [isOpen, setIsOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const [switching, setSwitching] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  const handleCopy = () => {
    if (!address) return
    navigator.clipboard.writeText(address)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleSwitchNetwork = async () => {
    setSwitching(true)
    try {
      await switchNetwork()
    } finally {
      setSwitching(false)
    }
  }

  const shortAddress = address
    ? `${address.slice(0, 6)}...${address.slice(-4)}`
    : ''

  // Case 1: Wallet not connected
  if (!address) {
    return (
      <div className="relative inline-block" ref={menuRef}>
        <Button
          size="sm"
          variant="secondary"
          loading={isConnecting}
          onClick={connect}
          className="border-surface-600 hover:border-primary-500/50"
        >
          <Wallet className="h-4 w-4 text-primary-400" />
          <span>Connect Wallet</span>
        </Button>

        {/* Connection Error Popover */}
        {error && (
          <div className="absolute right-0 mt-2 w-80 p-3 bg-surface-900 border border-red-500/40 rounded-xl shadow-xl z-50 text-xs text-surface-200 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-start gap-1.5 text-red-400 font-medium">
                <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                <span>Connection Error</span>
              </div>
              <button
                onClick={clearError}
                className="text-surface-400 hover:text-white"
                aria-label="Dismiss error"
              >
                ✕
              </button>
            </div>
            <p className="text-surface-300 leading-relaxed">{error}</p>
            {!isMetaMaskInstalled && (
              <a
                href="https://metamask.io/download/"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-primary-400 hover:text-primary-300 underline font-medium pt-1"
              >
                <span>Download MetaMask</span>
                <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>
        )}
      </div>
    )
  }

  // Case 2: Wallet connected
  return (
    <div className="relative inline-block" ref={menuRef}>
      <div className="flex items-center gap-2">
        {/* Wrong network badge outside dropdown for immediate visibility */}
        {!isCorrectNetwork && (
          <button
            onClick={handleSwitchNetwork}
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30 transition shadow-sm"
            title="Click to switch to supported network"
          >
            <AlertTriangle className="h-3.5 w-3.5 text-amber-400 animate-pulse" />
            <span>Wrong Network</span>
          </button>
        )}

        {/* Network indicator badge if correct */}
        {isCorrectNetwork && (
          <span className="hidden sm:inline-flex items-center gap-1.5 px-2 py-1 text-xs font-medium rounded-lg bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
            <span className="h-2 w-2 rounded-full bg-emerald-400" />
            <span className="truncate max-w-[110px]">{networkName || EXPECTED_CHAIN_NAME}</span>
          </span>
        )}

        {/* Connected account button */}
        <button
          onClick={() => setIsOpen(!isOpen)}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium border transition ${
            !isCorrectNetwork
              ? 'bg-surface-800/90 border-amber-500/40 text-amber-200 hover:bg-surface-800'
              : 'bg-surface-800/90 border-surface-600 text-surface-200 hover:text-white hover:border-surface-500'
          }`}
          aria-expanded={isOpen}
          aria-haspopup="true"
        >
          <div className="h-2 w-2 rounded-full bg-primary-400" />
          <span className="font-mono text-xs">{shortAddress}</span>
          <ChevronDown
            className={`h-3.5 w-3.5 text-surface-400 transition-transform duration-200 ${
              isOpen ? 'rotate-180' : ''
            }`}
          />
        </button>
      </div>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-72 bg-surface-900 border border-surface-700 rounded-xl shadow-2xl z-50 p-3 space-y-3">
          {/* Header & Full Address */}
          <div>
            <div className="flex items-center justify-between text-xs text-surface-400 mb-1">
              <span>Connected Wallet</span>
              <button
                onClick={handleCopy}
                className="flex items-center gap-1 text-primary-400 hover:text-primary-300"
                title="Copy address"
              >
                {copied ? (
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
            </div>
            <div className="bg-surface-950 p-2 rounded-lg border border-surface-800 font-mono text-[11px] text-surface-300 break-all select-all">
              {address}
            </div>
          </div>

          {/* Network details */}
          <div className="p-2.5 rounded-lg bg-surface-800/60 border border-surface-700/60 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-surface-400">Network:</span>
              <span
                className={`font-medium ${
                  isCorrectNetwork ? 'text-emerald-400' : 'text-amber-400'
                }`}
              >
                {networkName || 'Unknown Network'}
              </span>
            </div>

            {!isCorrectNetwork && (
              <div className="pt-1 border-t border-surface-700/60 space-y-2">
                <p className="text-[11px] text-amber-300/90 leading-tight">
                  App requires {EXPECTED_CHAIN_NAME}. Switch network to perform transactions.
                </p>
                <Button
                  size="sm"
                  variant="primary"
                  loading={switching}
                  onClick={handleSwitchNetwork}
                  className="w-full text-xs py-1.5"
                >
                  <RefreshCw className="h-3 w-3" />
                  <span>Switch to {EXPECTED_CHAIN_NAME}</span>
                </Button>
              </div>
            )}
          </div>

          {/* Disconnect Action */}
          <div className="pt-1 border-t border-surface-800">
            <button
              onClick={() => {
                disconnect()
                setIsOpen(false)
              }}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span>Disconnect Wallet</span>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
