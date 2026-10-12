import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { env } from '../config/env'
import { User, UserRole } from '../models/User'
import { sendError } from '../utils/response'

export interface JwtAuthPayload {
  userId: string
  role: UserRole
}

/**
 * Require valid JWT Bearer token in Authorization header.
 * Populates req.user, req.userId, and req.userRole.
 *
 * Immediately returns 403 ACCOUNT_DISABLED if the user's isActive flag is false
 * (Sprint 5A requirement: a disabled user's existing token must stop working).
 */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    sendError(res, 401, 'UNAUTHORIZED', 'No authorization token provided')
    return
  }

  const token = authHeader.split(' ')[1]

  let decoded: JwtAuthPayload
  try {
    decoded = jwt.verify(token, env.JWT_SECRET, { algorithms: ['HS256'] }) as JwtAuthPayload
  } catch {
    sendError(res, 401, 'UNAUTHORIZED', 'Invalid or expired authorization token')
    return
  }

  // Check isActive in the database so that disabling a user stops their existing token immediately
  User.findById(decoded.userId)
    .select('isActive role')
    .lean()
    .then((user) => {
      if (!user) {
        sendError(res, 401, 'UNAUTHORIZED', 'User not found')
        return
      }
      if (!user.isActive) {
        sendError(res, 403, 'ACCOUNT_DISABLED', 'This account has been disabled. Please contact an administrator.')
        return
      }

      req.user = {
        userId: decoded.userId,
        role:   decoded.role || 'USER',
      }
      req.userId   = decoded.userId
      req.userRole = decoded.role || 'USER'
      next()
    })
    .catch(() => {
      sendError(res, 500, 'INTERNAL_SERVER_ERROR', 'Authentication error')
    })
}

/**
 * Role-Based Access Control middleware.
 * Restricts route access to specified UserRoles.
 */
export function requireRole(...allowedRoles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      sendError(res, 401, 'UNAUTHORIZED', 'Authentication required')
      return
    }

    if (!allowedRoles.includes(req.user.role)) {
      sendError(res, 403, 'FORBIDDEN', 'Access forbidden: Insufficient permissions')
      return
    }

    next()
  }
}

// Backward-compatible alias for existing controllers
export const authenticate = requireAuth
