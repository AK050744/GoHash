import { Router } from 'express'
import { register, login, getMe, updateWallet, getWalletNonce } from '../controllers/auth.controller'
import { requireAuth } from '../middleware/auth.middleware'
import { validateBody } from '../middleware/validate'
import { registerSchema, loginSchema, updateWalletSchema } from '../validations/auth.validation'

const router = Router()

// Public authentication routes
router.post('/register', validateBody(registerSchema), register)
router.post('/login', validateBody(loginSchema), login)

// Authenticated user profile routes
router.get('/me', requireAuth, getMe)

// Wallet linking routes
router.post('/wallet/nonce', requireAuth, getWalletNonce)
router.patch('/wallet', requireAuth, validateBody(updateWalletSchema), updateWallet)

export default router
