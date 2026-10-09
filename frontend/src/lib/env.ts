// Read environment configuration at runtime (Vite replaces import.meta.env at build time)
export const API_URL: string =
  (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:5000/api'

export const EXPECTED_CHAIN_ID: number =
  Number((import.meta.env.VITE_EXPECTED_CHAIN_ID as string | undefined) ?? '31337')

export const EXPECTED_CHAIN_NAME: string =
  (import.meta.env.VITE_EXPECTED_CHAIN_NAME as string | undefined) ?? 'Hardhat Local'

export const RPC_URL: string =
  (import.meta.env.VITE_RPC_URL as string | undefined) ?? 'http://127.0.0.1:8545'
