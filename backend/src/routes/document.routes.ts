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
import { validate } from '../middleware/validate'
import {
  getDocumentsQuerySchema,
  documentIdParamSchema,
} from '../validations/document.validation'

const router = Router()

// All document routes require authentication
router.use(requireAuth)

router.post('/upload', uploadPdfMiddleware, uploadDocument)
router.get('/stats', getDocumentStats)
router.get('/', validate(getDocumentsQuerySchema, 'query'), getDocuments)
router.get('/:id', validate(documentIdParamSchema, 'params'), getDocumentById)
router.get('/:id/file', validate(documentIdParamSchema, 'params'), getDocumentFile)

export default router
