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
import { validate, validateBody } from '../middleware/validate'
import {
  requestNotarizationSchema,
  notarizationIdParamSchema,
  confirmNotarizationSchema,
} from '../validations/notarization.validation'

const router = Router()

// USER: request notarization for an owned document
router.post('/request', requireAuth, validateBody(requestNotarizationSchema), requestNotarization)

// NOTARY / ADMIN: list pending requests (with document + owner info)
router.get('/pending', requireAuth, requireRole('NOTARY', 'ADMIN'), getPendingNotarizations)

// NOTARY, ADMIN, or the requesting owner: get a single notarization
router.get('/:id', requireAuth, validate(notarizationIdParamSchema, 'params'), getNotarizationById)

// NOTARY only: reject / approve / confirm
router.post('/:id/reject',  requireAuth, requireRole('NOTARY'), validate(notarizationIdParamSchema, 'params'), rejectNotarization)
router.post('/:id/approve', requireAuth, requireRole('NOTARY'), validate(notarizationIdParamSchema, 'params'), approveNotarization)
router.post('/:id/confirm', requireAuth, requireRole('NOTARY'), validate(notarizationIdParamSchema, 'params'), validateBody(confirmNotarizationSchema), confirmNotarization)

export default router
