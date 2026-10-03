import { useState, useCallback } from 'react'
import { connectWallet, getProvider } from '../services/web3.service'

interface UseWalletReturn {
  account:     string | null
  chainId:     number | null
  isConnecting: boolean
  error:       string | null
  connect:     () => Promise<void>
  disconnect:  () => void
}

export function useWallet(): UseWalletReturn {
  const [account,      setAccount]      = useState<string | null>(null)
  const [chainId,      setChainId]      = useState<number | null>(null)
  const [isConnecting, setIsConnecting] = useState(false)
  const [error,        setError]        = useState<string | null>(null)

  const connect = useCallback(async () => {
    setIsConnecting(true)
    setError(null)
    try {
      const address  = await connectWallet()
      const provider = await getProvider()
      const network  = await provider.getNetwork()
      setAccount(address)
      setChainId(Number(network.chainId))
    } catch (err: any) {
      setError(err.message || 'Failed to connect wallet')
    } finally {
      setIsConnecting(false)
    }
  }, [])

  const disconnect = useCallback(() => {
    setAccount(null)
    setChainId(null)
  }, [])

  return { account, chainId, isConnecting, error, connect, disconnect }
}
