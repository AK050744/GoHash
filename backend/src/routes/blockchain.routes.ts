import { Router } from 'express'
import { getBlockchainDocument } from '../controllers/blockchain.controller'
import { requireAuth } from '../middleware/auth.middleware'

const router = Router()

// Owner, NOTARY, or ADMIN: retrieve stored + live on-chain notarization data
router.get('/:documentId', requireAuth, getBlockchainDocument)

export default router
