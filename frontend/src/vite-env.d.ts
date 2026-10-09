/// <reference types="vite/client" />

interface Window {
  ethereum?: {
    isMetaMask?: boolean
    request: (args: { method: string; params?: Array<unknown> | Record<string, unknown> }) => Promise<unknown>
    on?: (eventName: string, handler: (...args: unknown[]) => void) => void
    removeListener?: (eventName: string, handler: (...args: unknown[]) => void) => void
  }
}

interface ImportMetaEnv {
  readonly VITE_API_URL?: string
  readonly VITE_EXPECTED_CHAIN_ID?: string
  readonly VITE_EXPECTED_CHAIN_NAME?: string
  readonly VITE_RPC_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
