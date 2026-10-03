import { Request, Response, NextFunction } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { User } from '../models/User.model'
import { env } from '../config/env'

// ─── POST /api/auth/register ──────────────────────────────────────────────────
export async function register(req: Request, res: Response, next: NextFunction) {
  try {
    const { name, email, password } = req.body

    const existing = await User.findOne({ email })
    if (existing) {
      return res.status(409).json({ message: 'Email already in use' })
    }

    const hashed = await bcrypt.hash(password, 12)
    const user = await User.create({ name, email, password: hashed })

    const token = jwt.sign({ userId: user._id }, env.JWT_SECRET, {
      expiresIn: env.JWT_EXPIRES_IN,
    })

    return res.status(201).json({
      message: 'User registered successfully',
      token,
      user: { id: user._id, name: user.name, email: user.email },
    })
  } catch (err) {
    next(err)
  }
}

// ─── POST /api/auth/login ─────────────────────────────────────────────────────
export async function login(req: Request, res: Response, next: NextFunction) {
  try {
    const { email, password } = req.body

    const user = await User.findOne({ email }).select('+password')
    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' })
    }

    const match = await bcrypt.compare(password, user.password)
    if (!match) {
      return res.status(401).json({ message: 'Invalid credentials' })
    }

    const token = jwt.sign({ userId: user._id }, env.JWT_SECRET, {
      expiresIn: env.JWT_EXPIRES_IN,
    })

    return res.json({
      message: 'Login successful',
      token,
      user: { id: user._id, name: user.name, email: user.email },
    })
  } catch (err) {
    next(err)
  }
}

// ─── GET /api/auth/me ─────────────────────────────────────────────────────────
export async function getMe(req: Request, res: Response, next: NextFunction) {
  try {
    // req.userId is set by auth middleware
    const user = await User.findById((req as any).userId)
    if (!user) return res.status(404).json({ message: 'User not found' })

    return res.json({ user: { id: user._id, name: user.name, email: user.email, walletAddress: user.walletAddress } })
  } catch (err) {
    next(err)
  }
}
