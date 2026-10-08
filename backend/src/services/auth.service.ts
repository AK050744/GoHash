import crypto from 'crypto'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { ethers } from 'ethers'
import { User, IUser } from '../models/User'
import { env } from '../config/env'
import { ApiError } from '../utils/ApiError'
import { RegisterInput, LoginInput } from '../validations/auth.validation'

const BCRYPT_SALT_ROUNDS = 12
const NONCE_VALID_MINUTES = 5

export interface AuthSuccessPayload {
  token: string
  user: {
    id: string
    name: string
    email: string
    role: string
    walletAddress?: string | null
    isActive: boolean
  }
}

export interface NoncePayload {
  message: string
  expiresAt: string
}

export class AuthService {
  /**
   * Register a new user. Always assigns role USER regardless of any input role.
   */
  static async register(data: RegisterInput): Promise<AuthSuccessPayload> {
    const { name, email, password } = data

    // Check if user already exists
    const existing = await User.findOne({ email: email.toLowerCase() })
    if (existing) {
      throw ApiError.conflict('An account with this email already exists', 'EMAIL_ALREADY_EXISTS')
    }

    // Hash password with bcrypt cost 12
    const passwordHash = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS)

    // Strictly enforce role 'USER' for registration
    const user = await User.create({
      name,
      email: email.toLowerCase(),
      passwordHash,
      role: 'USER',
      isActive: true,
    })

    const token = this.generateToken(user._id.toString(), user.role)

    return {
      token,
      user: {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        role: user.role,
        walletAddress: user.walletAddress,
        isActive: user.isActive,
      },
    }
  }

  /**
   * Login user with email and password.
   * Throws identical generic error on wrong email, wrong password, or inactive account.
   */
  static async login(data: LoginInput): Promise<AuthSuccessPayload> {
    const { email, password } = data

    // Include passwordHash in query
    const user = await User.findOne({ email: email.toLowerCase() }).select('+passwordHash')

    // Constant-time check or generic failure
    if (!user) {
      throw ApiError.unauthorized('Invalid email or password', 'INVALID_CREDENTIALS')
    }

    // Check active status
    if (!user.isActive) {
      throw ApiError.unauthorized('Invalid email or password', 'INVALID_CREDENTIALS')
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash)
    if (!isMatch) {
      throw ApiError.unauthorized('Invalid email or password', 'INVALID_CREDENTIALS')
    }

    const token = this.generateToken(user._id.toString(), user.role)

    return {
      token,
      user: {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        role: user.role,
        walletAddress: user.walletAddress,
        isActive: user.isActive,
      },
    }
  }

  /**
   * Fetch current authenticated user by ID.
   */
  static async getMe(userId: string): Promise<Record<string, unknown>> {
    const user = await User.findById(userId)
    if (!user) {
      throw ApiError.notFound('User profile not found', 'USER_NOT_FOUND')
    }

    return {
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      role: user.role,
      walletAddress: user.walletAddress,
      isActive: user.isActive,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    }
  }

  /**
   * Generate a one-time nonce for wallet-link signature verification.
   * The nonce is stored (select:false) on the user document, valid for 5 minutes.
   * Returns a human-readable message the user must sign with their wallet.
   */
  static async generateWalletNonce(userId: string): Promise<NoncePayload> {
    const user = await User.findById(userId)
    if (!user) {
      throw ApiError.notFound('User not found', 'USER_NOT_FOUND')
    }

    const nonce     = crypto.randomBytes(16).toString('hex')
    const expiresAt = new Date(Date.now() + NONCE_VALID_MINUTES * 60 * 1000)

    const message = [
      'GoHash wallet link',
      `User: ${userId}`,
      `Nonce: ${nonce}`,
      `Expires: ${expiresAt.toISOString()}`,
    ].join('\n')

    // Save nonce (select:false fields must be set explicitly)
    await User.updateOne(
      { _id: userId },
      { walletNonce: nonce, walletNonceExpiry: expiresAt }
    )

    return { message, expiresAt: expiresAt.toISOString() }
  }

  /**
   * Verify a signed wallet-link message and persist the wallet address.
   *
   * Flow:
   *   1. Load user with walletNonce + walletNonceExpiry (select:false fields).
   *   2. Verify nonce is present and not expired.
   *   3. Reconstruct the canonical message from stored nonce.
   *   4. Recover signer via ethers.verifyMessage (never creates a Wallet).
   *   5. Check recovered address == walletAddress.
   *   6. Ensure no other user already owns that wallet.
   *   7. Persist lowercase walletAddress; clear nonce.
   */
  static async linkWallet(
    userId: string,
    walletAddress: string,
    signature: string
  ): Promise<Record<string, unknown>> {
    // Must select hidden fields
    const user = await User.findById(userId).select('+walletNonce +walletNonceExpiry')
    if (!user) {
      throw ApiError.notFound('User not found', 'USER_NOT_FOUND')
    }

    // Validate nonce
    if (
      !user.walletNonce ||
      !user.walletNonceExpiry ||
      new Date() > user.walletNonceExpiry
    ) {
      throw ApiError.badRequest('Nonce is invalid or has expired. Request a new one.', 'NONCE_INVALID')
    }

    // Reconstruct the exact message that was presented to the user
    const message = [
      'GoHash wallet link',
      `User: ${userId}`,
      `Nonce: ${user.walletNonce}`,
      `Expires: ${user.walletNonceExpiry.toISOString()}`,
    ].join('\n')

    // Recover the signer — ethers.verifyMessage does NOT create or hold any key
    let recovered: string
    try {
      recovered = ethers.verifyMessage(message, signature)
    } catch {
      throw ApiError.badRequest('Invalid signature', 'NONCE_INVALID')
    }

    if (recovered.toLowerCase() !== walletAddress.toLowerCase()) {
      throw ApiError.badRequest(
        'Signature does not match the provided wallet address',
        'NONCE_INVALID'
      )
    }

    // Ensure no other user already owns this wallet address
    const existing = await User.findOne({
      walletAddress: walletAddress.toLowerCase(),
      _id: { $ne: userId },
    })
    if (existing) {
      throw ApiError.conflict('This wallet address is already linked to another account', 'WALLET_IN_USE')
    }

    // Persist — clear nonce after use (one-time)
    const updated = await User.findByIdAndUpdate(
      userId,
      {
        walletAddress: walletAddress.toLowerCase(),
        walletNonce: null,
        walletNonceExpiry: null,
      },
      { new: true, runValidators: true }
    )

    if (!updated) {
      throw ApiError.notFound('User not found', 'USER_NOT_FOUND')
    }

    return {
      id: updated._id.toString(),
      name: updated.name,
      email: updated.email,
      role: updated.role,
      walletAddress: updated.walletAddress,
      isActive: updated.isActive,
    }
  }

  /**
   * Update public Ethereum wallet address for authenticated user (legacy direct update).
   * This path is kept for backward compatibility with smoke tests.
   */
  static async updateWallet(userId: string, walletAddress: string): Promise<Record<string, unknown>> {
    const user = await User.findByIdAndUpdate(
      userId,
      { walletAddress: walletAddress.toLowerCase() },
      { new: true, runValidators: true }
    )

    if (!user) {
      throw ApiError.notFound('User not found', 'USER_NOT_FOUND')
    }

    return {
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      role: user.role,
      walletAddress: user.walletAddress,
      isActive: user.isActive,
    }
  }

  /**
   * Generate signed JWT with userId and role.
   */
  static generateToken(userId: string, role: string): string {
    return jwt.sign(
      { userId, role },
      env.JWT_SECRET,
      { expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'] }
    )
  }

  /**
   * Helper: serialize a User document to API shape (no sensitive fields).
   */
  static serializeUser(user: IUser): Record<string, unknown> {
    return {
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      role: user.role,
      walletAddress: user.walletAddress,
      isActive: user.isActive,
    }
  }
}
