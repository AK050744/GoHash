import { Router } from 'express'
import { getFeeConfigHandler } from '../controllers/config.controller'

const router = Router()

// Public endpoint: get fee configuration
router.get('/fees', getFeeConfigHandler)

export default router
