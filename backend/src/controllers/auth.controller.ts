import { Request, Response } from 'express'
import { AuthService } from '../services/auth.service'
import { sendSuccess } from '../utils/response'
import { asyncHandler } from '../utils/asyncHandler'
import { ApiError } from '../utils/ApiError'
import { env } from '../config/env'

/**
 * POST /api/auth/register
 * Request: { name, email, password, confirmPassword, role? }
 * Response: 201 { success: true, token, user }
 */
export const register = asyncHandler(async (req: Request, res: Response) => {
  const result = await AuthService.register(req.body)
  sendSuccess(res, result, 201)
})

/**
 * POST /api/auth/login
 * Request: { email, password }
 * Response: 200 { success: true, token, user }
 */
export const login = asyncHandler(async (req: Request, res: Response) => {
  const result = await AuthService.login(req.body)
  sendSuccess(res, result, 200)
})

/**
 * GET /api/auth/me
 * Protected by requireAuth
 * Response: 200 { success: true, user }
 */
export const getMe = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.userId || req.user?.userId
  if (!userId) {
    throw ApiError.unauthorized('Authentication required')
  }

  const user = await AuthService.getMe(userId)
  sendSuccess(res, { user }, 200)
})

/**
 * POST /api/auth/wallet/nonce
 * Protected by requireAuth
 * Generates a one-time nonce message for wallet signature verification.
 * Response: 200 { success: true, message, expiresAt }
 */
export const getWalletNonce = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.userId || req.user?.userId
  if (!userId) {
    throw ApiError.unauthorized('Authentication required')
  }

  const nonce = await AuthService.generateWalletNonce(userId)
  sendSuccess(res, nonce, 200)
})

/**
 * PATCH /api/auth/wallet
 * Protected by requireAuth
 * Request: { walletAddress, signature }
 * Recovers signer from the previously issued nonce message.
 * Verifies recovered address == walletAddress, nonce valid and unused.
 * Response: 200 { success: true, user }
 */
export const updateWallet = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.userId || req.user?.userId
  if (!userId) {
    throw ApiError.unauthorized('Authentication required')
  }

  const { walletAddress, signature } = req.body
  if (!signature) {
    throw ApiError.badRequest('Signature is required for wallet linking', 'VALIDATION_ERROR')
  }

  const user = await AuthService.linkWallet(userId, walletAddress, signature)
  sendSuccess(res, { user }, 200)
})

/**
 * GET /api/auth/config
 * Public
 * Response: 200 { success: true, googleEnabled: boolean, googleClientId?: string }
 */
export const getAuthConfig = asyncHandler(async (_req: Request, res: Response) => {
  const googleEnabled = Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_ID.trim().length > 0)
  sendSuccess(
    res,
    {
      googleEnabled,
      ...(googleEnabled ? { googleClientId: env.GOOGLE_CLIENT_ID } : {}),
    },
    200
  )
})

/**
 * POST /api/auth/google
 * Public, rate-limited
 * Request: { credential }
 * Response: 200/201 { success: true, token, user }
 */
export const googleAuth = asyncHandler(async (req: Request, res: Response) => {
  const { credential } = req.body
  const result = await AuthService.googleLogin(credential)
  const statusCode = result.isNew ? 201 : 200
  sendSuccess(res, { token: result.token, user: result.user }, statusCode)
})

/**
 * POST /api/auth/google/link
 * Protected by requireAuth
 * Request: { credential }
 * Response: 200 { success: true, user }
 */
export const googleLink = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.userId || req.user?.userId
  if (!userId) {
    throw ApiError.unauthorized('Authentication required')
  }

  const { credential } = req.body
  const user = await AuthService.linkGoogle(userId, credential)
  sendSuccess(res, { user }, 200)
})
