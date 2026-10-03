import { Router } from 'express'
import { getProfile, updateProfile } from '../controllers/user.controller'
import { authenticate } from '../middlewares/auth.middleware'

const router = Router()

router.get('/profile',   authenticate, getProfile)
router.patch('/profile', authenticate, updateProfile)

export default router
