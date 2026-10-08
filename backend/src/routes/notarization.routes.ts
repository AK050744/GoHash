import { Router } from 'express'
import {
  requestNotarization,
  getPendingNotarizations,
  approveNotarization,
  rejectNotarization,
} from '../controllers/notarization.controller'
import { requireAuth } from '../middleware/auth.middleware'

const router = Router()

// Day 6: Request notarization
router.post('/request', requireAuth, requestNotarization)

// Day 9-10 endpoints (Stubs returning 501)
router.get('/pending',      requireAuth, getPendingNotarizations)
router.post('/:id/approve', requireAuth, approveNotarization)
router.post('/:id/reject',  requireAuth, rejectNotarization)

export default router
