import { Router } from 'express'
import {
  requestNotarization,
  getPendingNotarizations,
  getNotarizationById,
  approveNotarization,
  rejectNotarization,
  confirmNotarization,
} from '../controllers/notarization.controller'
import { requireAuth, requireRole } from '../middleware/auth.middleware'

const router = Router()

// USER: request notarization for an owned document
router.post('/request', requireAuth, requestNotarization)

// NOTARY / ADMIN: list pending requests (with document + owner info)
router.get('/pending', requireAuth, requireRole('NOTARY', 'ADMIN'), getPendingNotarizations)

// NOTARY, ADMIN, or the requesting owner: get a single notarization
router.get('/:id', requireAuth, getNotarizationById)

// NOTARY only: reject / approve / confirm
router.post('/:id/reject',  requireAuth, requireRole('NOTARY'), rejectNotarization)
router.post('/:id/approve', requireAuth, requireRole('NOTARY'), approveNotarization)
router.post('/:id/confirm', requireAuth, requireRole('NOTARY'), confirmNotarization)

export default router
