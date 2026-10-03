import { Request, Response, NextFunction } from 'express'
import { User } from '../models/User.model'

// ─── GET /api/users/profile ───────────────────────────────────────────────────
export async function getProfile(req: Request, res: Response, next: NextFunction) {
  try {
    const user = await User.findById((req as any).userId)
    if (!user) return res.status(404).json({ message: 'User not found' })
    return res.json({ user })
  } catch (err) {
    next(err)
  }
}

// ─── PATCH /api/users/profile ─────────────────────────────────────────────────
export async function updateProfile(req: Request, res: Response, next: NextFunction) {
  try {
    const { name, walletAddress } = req.body
    const user = await User.findByIdAndUpdate(
      (req as any).userId,
      { name, walletAddress },
      { new: true, runValidators: true }
    )
    if (!user) return res.status(404).json({ message: 'User not found' })
    return res.json({ message: 'Profile updated', user })
  } catch (err) {
    next(err)
  }
}
