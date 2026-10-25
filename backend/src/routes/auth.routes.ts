import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import { env } from '../config/env'
import {
  register,
  login,
  getMe,
  updateWallet,
  getWalletNonce,
  getAuthConfig,
  googleAuth,
  googleLink,
} from '../controllers/auth.controller'
import { requireAuth } from '../middleware/auth.middleware'
import { validateBody } from '../middleware/validate'
import {
  registerSchema,
  loginSchema,
  updateWalletSchema,
  googleAuthSchema,
} from '../validations/auth.validation'

const router = Router()

const authLimiter = rateLimit({
  windowMs: env.AUTH_RATE_LIMIT_WINDOW_MIN * 60 * 1000,
  max: () => env.AUTH_RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      code: 'RATE_LIMITED',
      message: 'Too many authentication attempts. Please try again later.',
    },
  },
})

// Public configuration route
router.get('/config', getAuthConfig)

// Public authentication routes
router.post('/register', authLimiter, validateBody(registerSchema), register)
router.post('/login', authLimiter, validateBody(loginSchema), login)
router.post('/google', authLimiter, validateBody(googleAuthSchema), googleAuth)

// Authenticated user profile routes
router.get('/me', requireAuth, getMe)
router.post('/google/link', requireAuth, validateBody(googleAuthSchema), googleLink)

// Wallet linking routes
router.post('/wallet/nonce', requireAuth, getWalletNonce)
router.patch('/wallet', requireAuth, validateBody(updateWalletSchema), updateWallet)

export default router

