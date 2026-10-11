import { Router } from 'express'
import { getContractMeta, getBlockchainDocument } from '../controllers/blockchain.controller'
import { requireAuth, requireRole } from '../middleware/auth.middleware'

const router = Router()

// ADMIN only: contract deployment metadata (address, chainId, ABI)
// Registered BEFORE /:documentId so "contract" is not treated as a Mongo ObjectId
router.get('/contract', requireAuth, requireRole('ADMIN'), getContractMeta)

// Owner, NOTARY, or ADMIN: retrieve stored + live on-chain notarization data
router.get('/:documentId', requireAuth, getBlockchainDocument)

export default router
