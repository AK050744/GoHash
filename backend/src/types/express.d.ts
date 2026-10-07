import { UserRole } from '../models/User'

declare global {
  namespace Express {
    interface Request {
      user?: {
        userId: string
        role: UserRole
      }
      userId?: string
      userRole?: UserRole
    }
  }
}

export {}
