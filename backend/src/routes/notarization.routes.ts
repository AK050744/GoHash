import { Router } from 'express'
import {
  requestNotarization,
  getPendingNotarizations,
  getUserNotarizations,
  getNotarizationById,
  approveNotarization,
  rejectNotarization,
  confirmNotarization,
  submitPayment,
} from '../controllers/notarization.controller'
import { requireAuth, requireRole } from '../middleware/auth.middleware'
import { validate, validateBody } from '../middleware/validate'
import {
  requestNotarizationSchema,
  notarizationIdParamSchema,
  confirmNotarizationSchema,
  paymentSchema,
  rejectNotarizationSchema,
  getNotarizationsQuerySchema,
} from '../validations/notarization.validation'

const router = Router()

// USER: request notarization for an owned document
router.post('/request', requireAuth, validateBody(requestNotarizationSchema), requestNotarization)

// USER who requested it: submit fee payment in test ETH
router.post('/:id/payment', requireAuth, validate(notarizationIdParamSchema, 'params'), validateBody(paymentSchema), submitPayment)

// NOTARY / ADMIN: list pending requests (with document + owner info)
router.get('/pending', requireAuth, requireRole('NOTARY', 'ADMIN'), getPendingNotarizations)

// Authenticated user: list own notarizations (with optional ?status= filter)
router.get('/', requireAuth, validate(getNotarizationsQuerySchema, 'query'), getUserNotarizations)

// NOTARY, ADMIN, or the requesting owner: get a single notarization
router.get('/:id', requireAuth, validate(notarizationIdParamSchema, 'params'), getNotarizationById)

// NOTARY only: reject / approve / confirm
router.post('/:id/reject', requireAuth, requireRole('NOTARY'), validate(notarizationIdParamSchema, 'params'), validateBody(rejectNotarizationSchema), rejectNotarization)
router.post('/:id/approve', requireAuth, requireRole('NOTARY'), validate(notarizationIdParamSchema, 'params'), approveNotarization)
router.post('/:id/confirm', requireAuth, requireRole('NOTARY'), validate(notarizationIdParamSchema, 'params'), validateBody(confirmNotarizationSchema), confirmNotarization)

export default router
