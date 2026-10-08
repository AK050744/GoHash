import fs from 'fs'
import { Request, Response } from 'express'
import { asyncHandler } from '../utils/asyncHandler'
import { DocumentService } from '../services/document.service'

/**
 * POST /api/documents/upload (USER)
 * Uploads a PDF document, validates '%PDF-' header, computes SHA-256,
 * stores file in backend/uploads/<documentId>.pdf, and creates Document record.
 */
export const uploadDocument = asyncHandler(async (req: Request, res: Response) => {
  const document = await DocumentService.uploadDocument(req.userId!, req.file)
  res.status(201).json({
    success: true,
    document,
  })
})

/**
 * GET /api/documents/stats (USER)
 * Returns document counts: total, pending, notarized for the authenticated user.
 */
export const getDocumentStats = asyncHandler(async (req: Request, res: Response) => {
  const stats = await DocumentService.getDocumentStats(req.userId!)
  res.status(200).json({
    success: true,
    total: stats.total,
    pending: stats.pending,
    notarized: stats.notarized,
    stats,
  })
})

/**
 * GET /api/documents (USER)
 * Returns list of documents owned by the user, newest first, with optional ?status= filter.
 */
export const getDocuments = asyncHandler(async (req: Request, res: Response) => {
  const status = typeof req.query.status === 'string' ? req.query.status : undefined
  const documents = await DocumentService.getDocuments(req.userId!, status)
  res.status(200).json({
    success: true,
    documents,
  })
})

/**
 * GET /api/documents/:id (owner, NOTARY, ADMIN)
 * Retrieves single document metadata. Returns 404 if not found or unauthorized.
 */
export const getDocumentById = asyncHandler(async (req: Request, res: Response) => {
  const document = await DocumentService.getDocumentById(req.params.id, req.userId!, req.userRole!)
  res.status(200).json({
    success: true,
    document,
  })
})

/**
 * GET /api/documents/:id/file (owner, NOTARY, ADMIN)
 * Streams the PDF file inline. Returns 404 if not found or unauthorized.
 */
export const getDocumentFile = asyncHandler(async (req: Request, res: Response) => {
  const { doc, filePath } = await DocumentService.getDocumentFile(req.params.id, req.userId!, req.userRole!)
  res.setHeader('Content-Type', 'application/pdf')
  const safeFilename = encodeURIComponent(doc.originalName).replace(/['()]/g, escape)
  res.setHeader('Content-Disposition', `inline; filename="${safeFilename}"; filename*=UTF-8''${safeFilename}`)
  fs.createReadStream(filePath).pipe(res)
})
