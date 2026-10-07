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

export interface DocumentRecord {
  _id: string
  fileName: string
  originalName: string
  mimeType: string
  fileSize: number
  sha256Hash: string
  visibility: 'PRIVATE' | 'PUBLIC'
  status: DocumentStatus
  ipfsCid: string | null
  createdAt: string
  updatedAt: string
}
