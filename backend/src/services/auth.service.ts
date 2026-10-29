import crypto from 'crypto'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { ethers } from 'ethers'
import { User, IUser } from '../models/User'
import { env } from '../config/env'
import { ApiError } from '../utils/ApiError'
import { RegisterInput, LoginInput } from '../validations/auth.validation'
import { GooglePayload, verifyGoogleIdToken } from './googleAuth.service'

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
    authProviders: string[]
    googleLinked: boolean
  }
}

export interface GoogleAuthResult {
  token: string
  user: Record<string, unknown>
  isNew: boolean
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
      authProviders: ['PASSWORD'],
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
        authProviders: user.authProviders || ['PASSWORD'],
        googleLinked: false,
      },
    }
  }

  /**
   * Login user with email and password.
   * Throws identical generic error on wrong email, wrong password, missing passwordHash, or inactive account.
   */
  static async login(data: LoginInput): Promise<AuthSuccessPayload> {
    const { email, password } = data

    // Include passwordHash and googleId in query
    const user = await User.findOne({ email: email.toLowerCase() }).select('+passwordHash +googleId')

    // Constant-time check or generic failure
    if (!user) {
      throw ApiError.unauthorized('Invalid email or password', 'INVALID_CREDENTIALS')
    }

    // Check active status
    if (!user.isActive) {
      throw ApiError.unauthorized('Invalid email or password', 'INVALID_CREDENTIALS')
    }

    // If account has no passwordHash (e.g. Google-only account), return generic 401 without crashing
    if (!user.passwordHash) {
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
        authProviders: user.authProviders || ['PASSWORD'],
        googleLinked: Boolean(user.googleId || user.authProviders?.includes('GOOGLE')),
      },
    }
  }

  /**
   * Fetch current authenticated user by ID.
   */
  static async getMe(userId: string): Promise<Record<string, unknown>> {
    const user = await User.findById(userId).select('+googleId')
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
      authProviders: user.authProviders || ['PASSWORD'],
      googleLinked: Boolean(user.googleId || user.authProviders?.includes('GOOGLE')),
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
   *   4. Clear the nonce immediately (one-time; any second attempt → NONCE_INVALID).
   *   5. Recover signer via ethers.verifyMessage (never creates or holds any key).
   *   6. Check recovered address == walletAddress (SIGNATURE_INVALID on mismatch).
   *   7. Ensure no other user already owns that wallet (WALLET_IN_USE).
   *   8. Persist lowercase walletAddress.
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

    // Clear nonce immediately after any attempt that reaches verification.
    // This means a replayed second call will get NONCE_INVALID even if the
    // first call had a bad signature.
    await User.updateOne(
      { _id: userId },
      { walletNonce: null, walletNonceExpiry: null }
    )

    // Recover the signer — ethers.verifyMessage does NOT create or hold any key.
    let recovered: string
    try {
      recovered = ethers.verifyMessage(message, signature)
    } catch {
      throw ApiError.badRequest('Invalid signature format', 'SIGNATURE_INVALID')
    }

    if (recovered.toLowerCase() !== walletAddress.toLowerCase()) {
      throw ApiError.badRequest(
        'Signature does not match the provided wallet address',
        'SIGNATURE_INVALID'
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

    // Persist lowercase walletAddress (nonce already cleared above)
    const updated = await User.findByIdAndUpdate(
      userId,
      { walletAddress: walletAddress.toLowerCase() },
      { new: true, runValidators: true }
    )

    if (!updated) {
      throw ApiError.notFound('User not found', 'USER_NOT_FOUND')
    }

    return this.serializeUser(updated)
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

    return this.serializeUser(user)
  }

  /**
   * Generate signed JWT with userId and role.
   */
  static generateToken(userId: string, role: string): string {
    return jwt.sign(
      { userId, role },
      env.JWT_SECRET,
      {
        algorithm: 'HS256',
        expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'],
      }
    )
  }

  /**
   * Helper: serialize a User document to API shape (no sensitive fields).
   * Invariant: Never includes googleId, Google email, or passwordHash.
   */
  static serializeUser(user: IUser): Record<string, unknown> {
    return {
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      role: user.role,
      walletAddress: user.walletAddress ?? null,
      isActive: user.isActive,
      authProviders: user.authProviders || ['PASSWORD'],
      googleLinked: Boolean(user.googleId || (user.authProviders && user.authProviders.includes('GOOGLE'))),
    }
  }

  /**
   * Google ID-token sign-in.
   * Public endpoint POST /api/auth/google
   */
  static async googleLogin(credential: string): Promise<GoogleAuthResult> {
    if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_ID.trim()) {
      throw new ApiError(503, 'GOOGLE_AUTH_DISABLED', 'Google authentication is currently disabled.')
    }

    let payload: GooglePayload
    try {
      payload = await verifyGoogleIdToken(credential)
    } catch {
      throw new ApiError(401, 'GOOGLE_TOKEN_INVALID', 'Invalid Google token.')
    }

    if (!payload.emailVerified) {
      throw new ApiError(401, 'GOOGLE_EMAIL_NOT_VERIFIED', 'Google email is not verified.')
    }

    const isGmail = payload.email.toLowerCase().endsWith('@gmail.com')
    const isWorkspace = Boolean(payload.hostedDomain && payload.hostedDomain.trim().length > 0)
    if (!isGmail && !isWorkspace) {
      throw new ApiError(403, 'GOOGLE_EMAIL_NOT_SUPPORTED', 'Use a Gmail or Google Workspace account.')
    }

    const existingByGoogleId = await User.findOne({ googleId: payload.sub }).select('+googleId')
    if (existingByGoogleId) {
      if (!existingByGoogleId.isActive) {
        throw new ApiError(403, 'ACCOUNT_DISABLED', 'This account has been disabled. Please contact an administrator.')
      }

      const token = this.generateToken(existingByGoogleId._id.toString(), existingByGoogleId.role)
      return {
        token,
        user: this.serializeUser(existingByGoogleId),
        isNew: false,
      }
    }

    const existingByEmail = await User.findOne({ email: payload.email.toLowerCase() }).select('+googleId')
    if (existingByEmail) {
      if (!existingByEmail.isActive) {
        throw new ApiError(403, 'ACCOUNT_DISABLED', 'This account has been disabled. Please contact an administrator.')
      }

      // Auto-link Google if not already linked since Google has verified their email
      if (!existingByEmail.googleId) {
        existingByEmail.googleId = payload.sub
        if (!existingByEmail.authProviders.includes('GOOGLE')) {
          existingByEmail.authProviders.push('GOOGLE')
        }
        await existingByEmail.save()
      } else if (existingByEmail.googleId !== payload.sub) {
        throw new ApiError(
          409,
          'GOOGLE_ALREADY_LINKED',
          'This email is already associated with a different Google account.'
        )
      }

      const token = this.generateToken(existingByEmail._id.toString(), existingByEmail.role)
      return {
        token,
        user: this.serializeUser(existingByEmail),
        isNew: false,
      }
    }

    const fallbackName = payload.name?.trim() || payload.email.split('@')[0]
    let newUser: IUser
    try {
      newUser = await User.create({
        name: fallbackName,
        email: payload.email.toLowerCase(),
        googleId: payload.sub,
        authProviders: ['GOOGLE'],
        role: 'USER',
        isActive: true,
      })
    } catch (err: any) {
      if (err.code === 11000) {
        const raceUser = await User.findOne({ googleId: payload.sub }).select('+googleId')
        if (raceUser) {
          if (!raceUser.isActive) {
            throw new ApiError(403, 'ACCOUNT_DISABLED', 'This account has been disabled. Please contact an administrator.')
          }
          const token = this.generateToken(raceUser._id.toString(), raceUser.role)
          return {
            token,
            user: this.serializeUser(raceUser),
            isNew: false,
          }
        }
        const raceEmailUser = await User.findOne({ email: payload.email.toLowerCase() }).select('+googleId')
        if (raceEmailUser) {
          if (!raceEmailUser.isActive) {
            throw new ApiError(403, 'ACCOUNT_DISABLED', 'This account has been disabled. Please contact an administrator.')
          }
          if (!raceEmailUser.googleId) {
            raceEmailUser.googleId = payload.sub
            if (!raceEmailUser.authProviders.includes('GOOGLE')) {
              raceEmailUser.authProviders.push('GOOGLE')
            }
            await raceEmailUser.save()
          }
          const token = this.generateToken(raceEmailUser._id.toString(), raceEmailUser.role)
          return {
            token,
            user: this.serializeUser(raceEmailUser),
            isNew: false,
          }
        }
      }
      throw err
    }

    const token = this.generateToken(newUser._id.toString(), newUser.role)
    return {
      token,
      user: this.serializeUser(newUser),
      isNew: true,
    }
  }

  /**
   * Link Google account to currently authenticated user.
   * Protected endpoint POST /api/auth/google/link
   */
  static async linkGoogle(userId: string, credential: string): Promise<Record<string, unknown>> {
    if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_ID.trim()) {
      throw new ApiError(503, 'GOOGLE_AUTH_DISABLED', 'Google authentication is currently disabled.')
    }

    let payload: GooglePayload
    try {
      payload = await verifyGoogleIdToken(credential)
    } catch {
      throw new ApiError(401, 'GOOGLE_TOKEN_INVALID', 'Invalid Google token.')
    }

    if (!payload.emailVerified) {
      throw new ApiError(401, 'GOOGLE_EMAIL_NOT_VERIFIED', 'Google email is not verified.')
    }

    const isGmail = payload.email.toLowerCase().endsWith('@gmail.com')
    const isWorkspace = Boolean(payload.hostedDomain && payload.hostedDomain.trim().length > 0)
    if (!isGmail && !isWorkspace) {
      throw new ApiError(403, 'GOOGLE_EMAIL_NOT_SUPPORTED', 'Use a Gmail or Google Workspace account.')
    }

    const currentUser = await User.findById(userId).select('+googleId')
    if (!currentUser) {
      throw ApiError.notFound('User not found', 'USER_NOT_FOUND')
    }
    if (!currentUser.isActive) {
      throw new ApiError(403, 'ACCOUNT_DISABLED', 'This account has been disabled. Please contact an administrator.')
    }

    // googleId already used by another user -> 409 GOOGLE_ALREADY_LINKED
    const otherUser = await User.findOne({
      googleId: payload.sub,
      _id: { $ne: currentUser._id },
    })
    if (otherUser) {
      throw new ApiError(
        409,
        'GOOGLE_ALREADY_LINKED',
        'This Google account is already linked to another GoHash account.'
      )
    }

    // this user already has a different googleId -> 409 ALREADY_LINKED
    // the same googleId again is an idempotent 200
    if (currentUser.googleId) {
      if (currentUser.googleId === payload.sub) {
        if (!currentUser.authProviders.includes('GOOGLE')) {
          currentUser.authProviders.push('GOOGLE')
          await currentUser.save()
        }
        return this.serializeUser(currentUser)
      } else {
        throw new ApiError(409, 'ALREADY_LINKED', 'A different Google account is already linked to this profile.')
      }
    }

    // On success add GOOGLE to authProviders and return the updated user
    currentUser.googleId = payload.sub
    if (!currentUser.authProviders.includes('GOOGLE')) {
      currentUser.authProviders.push('GOOGLE')
    }
    await currentUser.save()

    return this.serializeUser(currentUser)
  }
}

