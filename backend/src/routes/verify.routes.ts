import { Router } from 'express'
import { verifyDocument } from '../controllers/verify.controller'

const router = Router()

// Day 11 endpoint (Stub returning 501)
router.post('/', verifyDocument)

export default router
