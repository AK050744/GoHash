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

