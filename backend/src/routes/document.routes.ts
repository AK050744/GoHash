import { Router } from 'express'
import {
  notarizeDocument,
  verifyDocument,
  getMyDocuments,
  getDocumentById,
} from '../controllers/document.controller'
import { authenticate } from '../middlewares/auth.middleware'

const router = Router()

router.post('/notarize',     authenticate, notarizeDocument)
router.get('/verify/:hash',  verifyDocument)               // public
router.get('/',              authenticate, getMyDocuments)
router.get('/:id',           authenticate, getDocumentById)

export default router
