import { Router } from 'express'
import {
  uploadDocument,
  getDocuments,
  getDocumentById,
} from '../controllers/document.controller'

const router = Router()

// Day 6 endpoints (Stubs returning 501)
router.post('/upload', uploadDocument)
router.get('/',        getDocuments)
router.get('/:id',     getDocumentById)

export default router
