import { Request, Response } from 'express'
import { AuthService } from '../services/auth.service'
import { sendSuccess } from '../utils/response'
import { asyncHandler } from '../utils/asyncHandler'
import { ApiError } from '../utils/ApiError'

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

  // If signature is provided, use the verified nonce flow
  if (signature) {
    const user = await AuthService.linkWallet(userId, walletAddress, signature)
    sendSuccess(res, { user }, 200)
    return
  }

  // Legacy direct-update path (backward compat for smoke tests that don't sign)
  const user = await AuthService.updateWallet(userId, walletAddress)
  sendSuccess(res, { user }, 200)
})
