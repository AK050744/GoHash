// ─── Auth Types ───────────────────────────────────────────────────────────────

export interface AuthUser {
  id:            string
  name:          string
  email:         string
  walletAddress?: string
}

export interface AuthState {
  user:  AuthUser | null
  token: string | null
}

// ─── Document Types ───────────────────────────────────────────────────────────

export type DocumentStatus = 'pending' | 'notarized' | 'failed'

export interface NotarizedDocument {
  _id:          string
  owner:        string
  fileName:     string
  mimeType:     string
  fileSize:     number
  documentHash: string
  description:  string
  status:       DocumentStatus
  txHash?:      string
  blockNumber?: number
  notarizedAt?: string
  createdAt:    string
  updatedAt:    string
}

export interface NotarizePayload {
  documentHash: string
  description:  string
  fileName:     string
  mimeType:     string
  fileSize:     number
}

export interface VerificationResult {
  verified: boolean
  onChain?: {
    owner:       string
    notary:      string
    timestamp:   number
    notarizedAt: string
    ipfsCid:     string
  }
  dbRecord?: NotarizedDocument | null
}

// ─── API Response Wrapper ─────────────────────────────────────────────────────

export interface ApiResponse<T = unknown> {
  message?: string
  data?:    T
  error?:   string
}
