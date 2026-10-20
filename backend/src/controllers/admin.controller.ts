/**
 * controllers/admin.controller.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Admin-only endpoints (role: ADMIN).
 *
 * SECURITY INVARIANT: No response ever contains passwordHash.
 * The backend NEVER holds a private key.
 *
 * Endpoints:
 *   GET   /api/admin/users            — list users (?role, ?q, ?limit max 100)
 *   PATCH /api/admin/users/:id/role   — change a user's role
 *   PATCH /api/admin/users/:id/status — enable/disable a user
 *   GET   /api/admin/notaries         — NOTARY users with live onChainAuthorized
 *   GET   /api/admin/activity         — latest 50 notarizations
 *   GET   /api/admin/stats            — aggregate counts
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { Request, Response } from 'express'
import { asyncHandler } from '../utils/asyncHandler'
import { ApiError } from '../utils/ApiError'
import { sendSuccess } from '../utils/response'
import { User, UserRole } from '../models/User'
import { DocumentModel } from '../models/Document'
import { Notarization } from '../models/Notarization'
import { BlockchainService } from '../services/blockchain.service'

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Safe user projection — never exposes passwordHash.
 */
function safeUser(u: any) {
  return {
    id: u._id.toString(),
    name: u.name,
    email: u.email,
    role: u.role,
    walletAddress: u.walletAddress ?? null,
    isActive: u.isActive,
    createdAt: u.createdAt,
    updatedAt: u.updatedAt,
  }
}

// ─── GET /api/admin/users ─────────────────────────────────────────────────────

/**
 * GET /api/admin/users
 * Query params:
 *   ?role=USER|NOTARY|ADMIN  (filter by role)
 *   ?q=<string>              (case-insensitive name/email search)
 *   ?limit=<number>          (default 50, max 100)
 *
 * NEVER returns passwordHash.
 */
export const listUsers = asyncHandler(async (req: Request, res: Response) => {
  const roleFilter = typeof req.query.role === 'string' ? req.query.role : undefined
  const q = typeof req.query.q === 'string' ? req.query.q : undefined
  const rawLimit = typeof req.query.limit === 'string' ? parseInt(req.query.limit, 10) : 50
  const limit = Math.min(isNaN(rawLimit) || rawLimit < 1 ? 50 : rawLimit, 100)

  const filter: Record<string, unknown> = {}

  if (roleFilter && ['USER', 'NOTARY', 'ADMIN'].includes(roleFilter)) {
    filter.role = roleFilter as UserRole
  }

  if (q) {
    const pattern = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
    filter.$or = [{ name: pattern }, { email: pattern }]
  }

  const users = await User.find(filter)
    .select('-passwordHash -walletNonce -walletNonceExpiry')
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean()

  sendSuccess(res, { users: users.map(safeUser), total: users.length }, 200)
})

// ─── PATCH /api/admin/users/:id/role ─────────────────────────────────────────

/**
 * PATCH /api/admin/users/:id/role
 * Body: { role: "USER" | "NOTARY" | "ADMIN" }
 *
 * An admin CANNOT change their own role.
 * Changing a role does NOT authorize anyone on-chain.
 * NEVER returns passwordHash.
 */
export const changeUserRole = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params
  const { role } = req.body

  if (!role || !['USER', 'NOTARY', 'ADMIN'].includes(role)) {
    throw ApiError.badRequest('role must be one of: USER, NOTARY, ADMIN', 'VALIDATION_ERROR')
  }

  // An admin cannot modify their own role
  if (id === req.userId) {
    throw new ApiError(409, 'CANNOT_MODIFY_SELF', 'An admin cannot change their own role.')
  }

  const user = await User.findByIdAndUpdate(
    id,
    { role: role as UserRole },
    { new: true, select: '-passwordHash -walletNonce -walletNonceExpiry' }
  ).lean()

  if (!user) {
    throw ApiError.notFound('User not found', 'NOT_FOUND')
  }

  sendSuccess(res, { user: safeUser(user) }, 200)
})

// ─── PATCH /api/admin/users/:id/status ───────────────────────────────────────

/**
 * PATCH /api/admin/users/:id/status
 * Body: { isActive: boolean }
 *
 * An admin CANNOT disable themselves.
 * Disabling a user's account immediately invalidates their existing JWT
 * (enforced by requireAuth checking isActive on each request).
 * NEVER returns passwordHash.
 */
export const changeUserStatus = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params
  const { isActive } = req.body

  if (typeof isActive !== 'boolean') {
    throw ApiError.badRequest('isActive must be a boolean', 'VALIDATION_ERROR')
  }

  // An admin cannot disable themselves
  if (id === req.userId) {
    throw new ApiError(409, 'CANNOT_MODIFY_SELF', 'An admin cannot change their own active status.')
  }

  const user = await User.findByIdAndUpdate(
    id,
    { isActive },
    { new: true, select: '-passwordHash -walletNonce -walletNonceExpiry' }
  ).lean()

  if (!user) {
    throw ApiError.notFound('User not found', 'NOT_FOUND')
  }

  sendSuccess(res, { user: safeUser(user) }, 200)
})

// ─── PATCH /api/admin/users/:id/wallet ───────────────────────────────────────

/**
 * PATCH /api/admin/users/:id/wallet
 * Body: { walletAddress: string }
 *
 * Allows an admin to link/update a user's Ethereum wallet address directly.
 */
export const updateUserWallet = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params
  const { walletAddress } = req.body

  if (!walletAddress || typeof walletAddress !== 'string' || !/^0x[a-fA-F0-9]{40}$/.test(walletAddress)) {
    throw ApiError.badRequest('Valid Ethereum wallet address required (0x...)', 'VALIDATION_ERROR')
  }

  const normalized = walletAddress.toLowerCase()

  // Check if wallet is already used by another user
  const existing = await User.findOne({ walletAddress: normalized, _id: { $ne: id } })
  if (existing) {
    throw new ApiError(409, 'WALLET_ALREADY_LINKED', 'This wallet address is already linked to another user account.')
  }

  const user = await User.findByIdAndUpdate(
    id,
    { walletAddress: normalized },
    { new: true, select: '-passwordHash -walletNonce -walletNonceExpiry' }
  ).lean()

  if (!user) {
    throw ApiError.notFound('User not found', 'NOT_FOUND')
  }

  sendSuccess(res, { user: safeUser(user) }, 200)
})

// ─── GET /api/admin/notaries ──────────────────────────────────────────────────

/**
 * GET /api/admin/notaries
 * Returns all users with role NOTARY, including:
 *   - linkedWallet  (walletAddress)
 *   - onChainAuthorized: true | false | null
 *
 * If the chain is unreachable, returns the list with:
 *   onChainAuthorized: null, chainAvailable: false
 *
 * NEVER returns passwordHash.
 */
export const listNotaries = asyncHandler(async (_req: Request, res: Response) => {
  const notaryUsers = await User.find({ role: 'NOTARY' })
    .select('-passwordHash -walletNonce -walletNonceExpiry')
    .sort({ createdAt: -1 })
    .lean()

  let chainAvailable = true

  const notaries = await Promise.all(
    notaryUsers.map(async (u) => {
      let onChainAuthorized: boolean | null = null

      if (u.walletAddress) {
        try {
          onChainAuthorized = await BlockchainService.isNotaryAuthorized(u.walletAddress)
        } catch {
          chainAvailable = false
        }
      } else {
        // No wallet linked — cannot be authorized on-chain
        onChainAuthorized = false
      }

      return {
        ...safeUser(u),
        linkedWallet: u.walletAddress ?? null,
        onChainAuthorized: chainAvailable ? onChainAuthorized : null,
      }
    })
  )

  sendSuccess(res, { notaries, chainAvailable }, 200)
})

// ─── GET /api/admin/activity ──────────────────────────────────────────────────

/**
 * GET /api/admin/activity
 * Returns the latest 50 notarizations, newest first.
 * Each entry includes: status, document name, requester name,
 * notary wallet, timestamps.
 *
 * NEVER returns owner email or passwordHash.
 */
export const getActivity = asyncHandler(async (_req: Request, res: Response) => {
  const records = await Notarization.find()
    .sort({ createdAt: -1 })
    .limit(50)
    .populate<{ documentId: { _id: any; originalName: string } | null }>(
      'documentId',
      'originalName'
    )
    .populate<{ requestedBy: { _id: any; name: string } | null }>(
      'requestedBy',
      'name'
    )
    .lean()

  const activity = records.map((n) => {
    const doc = n.documentId as any
    const requester = n.requestedBy as any
    return {
      id: n._id.toString(),
      status: n.status,
      documentName: doc?.originalName ?? null,
      requesterName: requester?.name ?? null,
      notaryWallet: n.notaryWallet ?? null,
      transactionHash: n.transactionHash ?? null,
      blockNumber: n.blockNumber ?? null,
      createdAt: n.createdAt,
      updatedAt: n.updatedAt,
    }
  })

  sendSuccess(res, { activity }, 200)
})

// ─── GET /api/admin/stats ─────────────────────────────────────────────────────

/**
 * GET /api/admin/stats
 * Returns aggregate counts:
 *   users:          { total, byRole: { USER, NOTARY, ADMIN } }
 *   notaries:       { total, withWallet }
 *   documents:      { total, byStatus: { PENDING, APPROVED, REJECTED, NOTARIZED } }
 *   notarizations:  { total, byStatus: { REQUESTED, APPROVED, REJECTED, CONFIRMED, FAILED } }
 */
export const getStats = asyncHandler(async (_req: Request, res: Response) => {
  const [
    totalUsers,
    usersByRole,
    totalDocs,
    docsByStatus,
    totalNotarizationsCount,
    notarizationsByStatus,
    notariesWithWallet,
  ] = await Promise.all([
    User.countDocuments(),
    User.aggregate([
      { $group: { _id: '$role', count: { $sum: 1 } } },
    ]),
    DocumentModel.countDocuments(),
    DocumentModel.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]),
    Notarization.countDocuments(),
    Notarization.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]),
    User.countDocuments({ role: 'NOTARY', walletAddress: { $ne: null } }),
  ])

  // Build role map
  const roleMap: Record<string, number> = { USER: 0, NOTARY: 0, ADMIN: 0 }
  for (const row of usersByRole) {
    if (row._id in roleMap) roleMap[row._id as string] = row.count
  }

  // Build document status map
  const docStatusMap: Record<string, number> = { PENDING: 0, APPROVED: 0, REJECTED: 0, NOTARIZED: 0 }
  for (const row of docsByStatus) {
    if (row._id in docStatusMap) docStatusMap[row._id as string] = row.count
  }

  // Build notarization status map
  const notStatusMap: Record<string, number> = {
    REQUESTED: 0, APPROVED: 0, REJECTED: 0, CONFIRMED: 0, FAILED: 0,
  }
  for (const row of notarizationsByStatus) {
    if (row._id in notStatusMap) notStatusMap[row._id as string] = row.count
  }

  // Aggregate fee stats
  const paidRecords = await Notarization.find(
    { 'payment.status': 'PAID' },
    { 'payment.amountWei': 1 }
  ).lean()
  let totalWei = 0n
  for (const r of paidRecords) {
    if (r.payment?.amountWei) {
      try {
        totalWei += BigInt(r.payment.amountWei)
      } catch {
        // ignore malformed numbers
      }
    }
  }

  sendSuccess(res, {
    users: {
      total: totalUsers,
      byRole: roleMap,
    },
    notaries: {
      total: roleMap.NOTARY,
      withWallet: notariesWithWallet,
    },
    documents: {
      total: totalDocs,
      byStatus: docStatusMap,
    },
    notarizations: {
      total: totalNotarizationsCount,
      byStatus: notStatusMap,
    },
    fees: {
      paidCount: paidRecords.length,
      totalWei: totalWei.toString(),
    },
  }, 200)
})
