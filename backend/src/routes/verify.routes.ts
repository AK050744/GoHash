/**
 * routes/verify.routes.ts
 * POST /api/verify  (public — no authentication required)
 *
 * Rate limit: VERIFY_RATE_LIMIT_PER_MIN per minute per IP.
 * Configurable via env var so tests can raise the limit.
 */
import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import { verifyDocument } from '../controllers/verify.controller'
import { uploadPdfMiddleware } from '../middleware/upload.middleware'
import { env } from '../config/env'

const router = Router()

const verifyLimiter = rateLimit({
  windowMs: 60 * 1000,                        // 1 minute window
  max:             () => env.VERIFY_RATE_LIMIT_PER_MIN, // dynamically reads env var so tests can override
  standardHeaders: true,
  legacyHeaders:   false,
  message: {
    success: false,
    error: {
      code:    'RATE_LIMITED',
      message: 'Too many verification requests. Please try again in a minute.',
    },
  },
})

// Public: no requireAuth
router.post('/', verifyLimiter, uploadPdfMiddleware, verifyDocument)

export default router
