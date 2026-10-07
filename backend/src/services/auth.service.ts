import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { User, IUser } from '../models/User'
import { env } from '../config/env'
import { ApiError } from '../utils/ApiError'
import { RegisterInput, LoginInput } from '../validations/auth.validation'

const BCRYPT_SALT_ROUNDS = 12

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
   * Update public Ethereum wallet address for authenticated user.
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
}
