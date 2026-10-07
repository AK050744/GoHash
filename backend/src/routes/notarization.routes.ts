import { Router } from 'express'
import {
  requestNotarization,
  getPendingNotarizations,
  approveNotarization,
  rejectNotarization,
} from '../controllers/notarization.controller'

const router = Router()

// Day 9-10 endpoints (Stubs returning 501)
router.post('/request',      requestNotarization)
router.get('/pending',       getPendingNotarizations)
router.post('/:id/approve',  approveNotarization)
router.post('/:id/reject',   rejectNotarization)

export default router
