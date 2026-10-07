import { Request, Response } from 'express'
import { ApiError } from '../utils/ApiError'
import { asyncHandler } from '../utils/asyncHandler'

/**
 * POST /api/documents/upload (Planned Day 6)
 */
export const uploadDocument = asyncHandler(async (_req: Request, _res: Response) => {
  throw ApiError.notImplemented('Document upload endpoint planned for Day 6')
})

/**
 * GET /api/documents (Planned Day 6)
 */
export const getDocuments = asyncHandler(async (_req: Request, _res: Response) => {
  throw ApiError.notImplemented('Document listing endpoint planned for Day 6')
})

/**
 * GET /api/documents/:id (Planned Day 6)
 */
export const getDocumentById = asyncHandler(async (_req: Request, _res: Response) => {
  throw ApiError.notImplemented('Document retrieval endpoint planned for Day 6')
})
