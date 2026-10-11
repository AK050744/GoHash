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
  status?: string
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

// ─── Verification API types ──────────────────────────────────────────────────

export interface VerifyRecord {
  ownerWallet: string
  notaryWallet: string
  timestamp: number
  contractAddress: string
  transactionHash?: string | null
  blockNumber?: number | null
}

export interface VerifyDocumentMeta {
  id?: string
  originalName?: string
}

export interface VerifyResponse {
  success: boolean
  status: 'VERIFIED' | 'NOT_VERIFIED'
  hash: string
  record?: VerifyRecord
  document?: VerifyDocumentMeta
  message?: string
}

// ─── Blockchain Contract Info (Admin) ────────────────────────────────────────

export interface BlockchainContractResponse {
  success: boolean
  contractAddress: string
  chainId: number
  abi: string[]
}

// ─── Admin API types ─────────────────────────────────────────────────────────

export interface AdminUser extends User {
  createdAt?: string
  updatedAt?: string
}

export interface AdminUsersResponse {
  success: boolean
  users: AdminUser[]
  total: number
}

export interface AdminNotary extends AdminUser {
  linkedWallet: string | null
  onChainAuthorized: boolean | null
}

export interface AdminNotariesResponse {
  success: boolean
  notaries: AdminNotary[]
  chainAvailable: boolean
}

export interface AdminActivityItem {
  id: string
  status: NotarizationStatus
  documentName: string | null
  requesterName: string | null
  notaryWallet: string | null
  transactionHash: string | null
  blockNumber: number | null
  createdAt: string
  updatedAt: string
}

export interface AdminActivityResponse {
  success: boolean
  activity: AdminActivityItem[]
}

export interface AdminStatsResponse {
  success: boolean
  users: {
    total: number
    byRole: { USER: number; NOTARY: number; ADMIN: number }
  }
  notaries: {
    total: number
    withWallet: number
  }
  documents: {
    total: number
    byStatus: { PENDING: number; APPROVED: number; REJECTED: number; NOTARIZED: number }
  }
  notarizations: {
    total: number
    byStatus: { REQUESTED: number; APPROVED: number; REJECTED: number; CONFIRMED: number; FAILED: number }
  }
}
