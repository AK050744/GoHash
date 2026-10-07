import { Router } from 'express'
import { getBlockchainDocument } from '../controllers/blockchain.controller'

const router = Router()

// Day 8-10 endpoint (Stub returning 501)
router.get('/:documentId', getBlockchainDocument)

export default router
