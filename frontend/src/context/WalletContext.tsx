import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from 'react'
import { ethers } from 'ethers'
import {
  EXPECTED_CHAIN_ID,
  EXPECTED_CHAIN_NAME,
  RPC_URL,
} from '../lib/env'

export interface WalletContextType {
  address: string | null
  chainId: number | null
  networkName: string | null
  isCorrectNetwork: boolean
  isConnecting: boolean
  error: string | null
  isMetaMaskInstalled: boolean
  provider: ethers.BrowserProvider | null
  connect: () => Promise<void>
  disconnect: () => Promise<void>
  switchNetwork: () => Promise<void>
  clearError: () => void
}

const WalletContext = createContext<WalletContextType | undefined>(undefined)

function resolveNetworkName(id: number | null): string | null {
  if (id === null) return null
  if (id === EXPECTED_CHAIN_ID) return EXPECTED_CHAIN_NAME
  if (id === 1) return 'Ethereum Mainnet'
  if (id === 11155111) return 'Sepolia Testnet'
  if (id === 5) return 'Goerli Testnet'
  if (id === 1337) return 'Localhost (1337)'
  return `Chain ID ${id}`
}

export function WalletProvider({ children }: { children: ReactNode }) {
  const [address, setAddress] = useState<string | null>(null)
  const [chainId, setChainId] = useState<number | null>(null)
  const [isConnecting, setIsConnecting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [provider, setProvider] = useState<ethers.BrowserProvider | null>(null)

  const isMetaMaskInstalled = typeof window !== 'undefined' && Boolean(window.ethereum)
  const isCorrectNetwork = chainId === EXPECTED_CHAIN_ID
  const networkName = resolveNetworkName(chainId)

  const clearError = useCallback(() => {
    setError(null)
  }, [])

  // Initialize provider and check silent connection on mount
  useEffect(() => {
    if (!window.ethereum) return

    const browserProvider = new ethers.BrowserProvider(window.ethereum)
    setProvider(browserProvider)

    // Check if accounts are already connected without triggering popup
    window.ethereum
      .request({ method: 'eth_accounts' })
      .then(async (result) => {
        const accounts = result as string[]
        if (accounts && accounts.length > 0) {
          try {
            setAddress(ethers.getAddress(accounts[0]))
            const network = await browserProvider.getNetwork()
            setChainId(Number(network.chainId))
          } catch {
            // Address or chain read issue; leave as disconnected
          }
        }
      })
      .catch(() => {
        // Silent check error ignored
      })
  }, [])

  // Accounts & chain event listeners
  useEffect(() => {
    if (!window.ethereum?.on) return

    const handleAccountsChanged = (accountsUnknown: unknown) => {
      const accounts = accountsUnknown as string[]
      if (!accounts || accounts.length === 0) {
        setAddress(null)
      } else {
        try {
          setAddress(ethers.getAddress(accounts[0]))
        } catch {
          setAddress(accounts[0])
        }
      }
      setError(null)
    }

    const handleChainChanged = (chainIdHexUnknown: unknown) => {
      const chainIdHex = chainIdHexUnknown as string
      try {
        const parsedChainId = parseInt(chainIdHex, 16)
        setChainId(parsedChainId)
      } catch {
        setChainId(null)
      }
      setError(null)
    }

    window.ethereum.on('accountsChanged', handleAccountsChanged)
    window.ethereum.on('chainChanged', handleChainChanged)

    return () => {
      window.ethereum?.removeListener?.('accountsChanged', handleAccountsChanged)
      window.ethereum?.removeListener?.('chainChanged', handleChainChanged)
    }
  }, [])

  /**
   * Connect to MetaMask via eth_requestAccounts
   */
  const connect = useCallback(async () => {
    setError(null)

    if (!window.ethereum) {
      setError('MetaMask is not installed. Please install it from metamask.io.')
      return
    }

    setIsConnecting(true)

    try {
      const browserProvider = new ethers.BrowserProvider(window.ethereum)
      setProvider(browserProvider)

      const accountsResult = await window.ethereum.request({
        method: 'eth_requestAccounts',
      })

      const accounts = accountsResult as string[]
      if (accounts && accounts.length > 0) {
        try {
          setAddress(ethers.getAddress(accounts[0]))
        } catch {
          setAddress(accounts[0])
        }

        const network = await browserProvider.getNetwork()
        setChainId(Number(network.chainId))
      }
    } catch (err: unknown) {
      const ethErr = err as { code?: number | string; message?: string }

      // Map error codes
      if (ethErr.code === 4001 || ethErr.code === 'ACTION_REJECTED') {
        setError('Connection request was rejected in MetaMask.')
      } else if (ethErr.code === -32002) {
        setError('Open the MetaMask window: a connection request is already pending.')
      } else {
        setError(ethErr.message || 'Failed to connect MetaMask wallet.')
      }
    } finally {
      setIsConnecting(false)
    }
  }, [])

  /**
   * Disconnect from local state.
   *
   * Note: A website cannot force-disconnect MetaMask or revoke permissions automatically;
   * MetaMask retains site authorization until manually revoked by the user.
   * We clear our local application state and attempt wallet_revokePermissions inside try/catch as a best effort.
   */
  const disconnect = useCallback(async () => {
    // Clear application wallet state
    setAddress(null)
    setChainId(null)
    setError(null)

    // Best effort permission revocation
    try {
      if (window.ethereum?.request) {
        await window.ethereum.request({
          method: 'wallet_revokePermissions',
          params: [{ eth_accounts: {} }],
        })
      }
    } catch {
      // Best-effort attempt; ignore error if wallet does not support revocation
    }
  }, [])

  /**
   * Switch MetaMask to the expected chain (VITE_EXPECTED_CHAIN_ID),
   * falling back to wallet_addEthereumChain on 4902 if the chain has not been added.
   */
  const switchNetwork = useCallback(async () => {
    if (!window.ethereum) {
      setError('MetaMask is not installed. Please install it from metamask.io.')
      return
    }

    setError(null)
    const hexChainId = `0x${EXPECTED_CHAIN_ID.toString(16)}`

    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: hexChainId }],
      })
      setChainId(EXPECTED_CHAIN_ID)
    } catch (switchError: unknown) {
      const err = switchError as { code?: number | string; message?: string }

      // 4902: Unrecognized chain ID, request adding the chain
      if (err.code === 4902) {
        try {
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [
              {
                chainId: hexChainId,
                chainName: EXPECTED_CHAIN_NAME,
                rpcUrls: [RPC_URL],
                nativeCurrency: {
                  name: 'ETH',
                  symbol: 'ETH',
                  decimals: 18,
                },
              },
            ],
          })
          setChainId(EXPECTED_CHAIN_ID)
        } catch (addError: unknown) {
          const addErr = addError as { code?: number | string; message?: string }
          if (addErr.code === 4001 || addErr.code === 'ACTION_REJECTED') {
            setError('Adding network was rejected in MetaMask.')
          } else {
            setError(addErr.message || 'Failed to add network to MetaMask.')
          }
        }
      } else if (err.code === 4001 || err.code === 'ACTION_REJECTED') {
        setError('Network switch was rejected in MetaMask.')
      } else if (err.code === -32002) {
        setError('Open the MetaMask window: a network request is already pending.')
      } else {
        setError(err.message || 'Failed to switch network in MetaMask.')
      }
    }
  }, [])

  return (
    <WalletContext.Provider
      value={{
        address,
        chainId,
        networkName,
        isCorrectNetwork,
        isConnecting,
        error,
        isMetaMaskInstalled,
        provider,
        connect,
        disconnect,
        switchNetwork,
        clearError,
      }}
    >
      {children}
    </WalletContext.Provider>
  )
}

export function useWallet(): WalletContextType {
  const context = useContext(WalletContext)
  if (!context) {
    throw new Error('useWallet must be used within a WalletProvider')
  }
  return context
}
