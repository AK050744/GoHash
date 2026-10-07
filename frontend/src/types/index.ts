// ─── User & Auth Types ────────────────────────────────────────────────────────

export type UserRole = 'USER' | 'NOTARY' | 'ADMIN'

export interface User {
  id: string
  name: string
  email: string
  role: UserRole
  walletAddress?: string | null
  isActive: boolean
  createdAt?: string
  updatedAt?: string
}

export interface AuthResponse {
  success: true
  token: string
  user: User
}

export interface UserResponse {
  success: true
  user: User
}

// ─── API Envelope Types ───────────────────────────────────────────────────────

export interface ApiSuccessEnvelope<T = unknown> {
  success: true
  [key: string]: unknown
}

export interface ApiErrorDetail {
  code: string
  message: string
  details?: unknown
}

export interface ApiErrorEnvelope {
  success: false
  error: ApiErrorDetail
}

export class ApiError extends Error {
  public code: string
  public status: number
  public details?: unknown

  constructor(status: number, error: ApiErrorDetail) {
    super(error.message)
    this.name = 'ApiError'
    this.status = status
    this.code = error.code
    this.details = error.details
  }
}

// ─── Document & Notarization Types ────────────────────────────────────────────

export type DocumentVisibility = 'PRIVATE' | 'PUBLIC'
export type DocumentStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'NOTARIZED'
export type NotarizationStatus = 'REQUESTED' | 'APPROVED' | 'REJECTED' | 'CONFIRMED' | 'FAILED'

export interface DocumentRecord {
  _id: string
  ownerId: string
  fileName: string
  originalName: string
  mimeType: string
  fileSize: number
  sha256Hash: string
  storagePath: string
  ipfsCid: string | null
  visibility: DocumentVisibility
  status: DocumentStatus
  createdAt: string
  updatedAt: string
}
