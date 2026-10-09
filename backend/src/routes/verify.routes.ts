import { Router } from 'express'
import { verifyDocument } from '../controllers/verify.controller'

const router = Router()

// Sprint 5A endpoint (Stub returning 501)
router.post('/', verifyDocument)

export default router
