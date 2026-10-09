// ─── Shared application types ────────────────────────────────────────────────

export type UserRole = 'USER' | 'NOTARY' | 'ADMIN'

export interface User {
  id: string
  name: string
  email: string
  role: UserRole
  walletAddress: string | null
  isActive: boolean
}

// API contract envelope shapes
export interface AuthResponse {
  success: true
  token: string
  user: User
}

export interface MeResponse {
  success: true
  user: User
}

export type DocumentStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'NOTARIZED'

export type NotarizationStatus = 'REQUESTED' | 'APPROVED' | 'REJECTED' | 'CONFIRMED' | 'FAILED'

export interface DocumentNotarization {
  id: string
  documentId?: string
  status: NotarizationStatus
  documentHash?: string
  transactionHash?: string | null
  blockNumber?: number | null
  notaryWallet?: string | null
  notaryId?: string | null
  contractAddress?: string | null
  timestamp?: number | null
  onChainTimestamp?: number | null
  rejectionReason?: string | null
  failureReason?: string | null
  createdAt?: string
  updatedAt?: string
}

export interface Document {
  id: string
  originalName: string
  fileName?: string
  mimeType?: string
  fileSize?: number
  sha256Hash: string
  visibility?: 'PRIVATE' | 'PUBLIC'
  status: DocumentStatus
  ipfsCid?: string | null
  ownerId?: string
  createdAt: string
  updatedAt?: string
  notarization?: DocumentNotarization | null
}

export type DocumentRecord = Document

export interface DocumentStats {
  total: number
  pending: number
  notarized: number
}

export interface DocumentStatsResponse {
  success: boolean
  total: number
  pending: number
  notarized: number
  stats?: DocumentStats
}

export interface DocumentListResponse {
  success: boolean
  documents: Document[]
}

export interface DocumentDetailResponse {
  success: boolean
  document: Document
}

export interface DocumentUploadResponse {
  success: boolean
  document: {
    id: string
    originalName: string
    sha256Hash: string
    status: DocumentStatus
    createdAt: string
  }
}

export interface NotarizationRequestResponse {
  success: boolean
  notarization: {
    id: string
    documentId: string
    status: string
    documentHash: string
    requestedBy: string
    createdAt: string
  }
}

export interface PendingNotarizationItem {
  id: string
  documentId: string
  requestedBy: string
  notaryId?: string | null
  notaryWallet?: string | null
  documentHash: string
  transactionHash?: string | null
  blockNumber?: number | null
  contractAddress?: string | null
  chainId?: number | null
  onChainTimestamp?: number | null
  rejectionReason?: string | null
  failureReason?: string | null
  status: NotarizationStatus
  createdAt: string
  updatedAt: string
  document?: Document | null
  owner?: { name?: string; email?: string; walletAddress?: string } | null
}

export interface PendingNotarizationsResponse {
  success: boolean
  notarizations: PendingNotarizationItem[]
}

export interface NotarizationDetailResponse {
  success: boolean
  notarization: PendingNotarizationItem
}

export interface ApproveNotarizationResponse {
  success: boolean
  notarization: PendingNotarizationItem
  contractAddress: string
  chainId: number
  abi: unknown[]
  method: string
  args: [string, string, string]
}

export interface ConfirmNotarizationResponse {
  success: boolean
  code?: string
  message?: string
  notarization?: PendingNotarizationItem
}

export interface WalletNonceResponse {
  success: boolean
  message: string
  expiresAt: string
}

export interface WalletLinkResponse {
  success: boolean
  user: User
}
