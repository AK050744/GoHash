/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL:            string
  readonly VITE_CHAIN_ID:                string
  readonly VITE_NOTARY_CONTRACT_ADDRESS: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
