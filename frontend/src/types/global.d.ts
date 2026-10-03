// Augment the Window interface to include the MetaMask ethereum provider
interface Window {
  ethereum?: {
    isMetaMask?:         boolean
    request:             (args: { method: string; params?: unknown[] }) => Promise<unknown>
    on:                  (event: string, handler: (...args: unknown[]) => void) => void
    removeListener:      (event: string, handler: (...args: unknown[]) => void) => void
    selectedAddress?:    string | null
    chainId?:            string
  }
}
