import { Router } from 'express'
import {
  uploadDocument,
  getDocumentStats,
  getDocuments,
  getDocumentById,
  getDocumentFile,
} from '../controllers/document.controller'
import { requireAuth } from '../middleware/auth.middleware'
import { uploadPdfMiddleware } from '../middleware/upload.middleware'

const router = Router()

// All document routes require authentication
router.use(requireAuth)

router.post('/upload', uploadPdfMiddleware, uploadDocument)
router.get('/stats', getDocumentStats)
router.get('/', getDocuments)
router.get('/:id', getDocumentById)
router.get('/:id/file', getDocumentFile)

export default router
