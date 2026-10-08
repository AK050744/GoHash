import { Router } from 'express'
import { register, login, getMe, updateWallet } from '../controllers/auth.controller'
import { requireAuth, requireRole } from '../middleware/auth.middleware'
import { validateBody } from '../middleware/validate'
import { registerSchema, loginSchema, updateWalletSchema } from '../validations/auth.validation'
import { sendSuccess } from '../utils/response'

const router = Router()

// Public authentication routes
router.post('/register', validateBody(registerSchema), register)
router.post('/login', validateBody(loginSchema), login)

// Authenticated user profile routes
router.get('/me', requireAuth, getMe)
router.patch('/wallet', requireAuth, validateBody(updateWalletSchema), updateWallet)

export default router
