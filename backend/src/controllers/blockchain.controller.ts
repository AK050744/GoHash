import { Request, Response } from 'express'
import { ApiError } from '../utils/ApiError'
import { asyncHandler } from '../utils/asyncHandler'

/**
 * GET /api/blockchain/:documentId (Planned Day 8-10)
 */
export const getBlockchainDocument = asyncHandler(async (_req: Request, _res: Response) => {
  throw ApiError.notImplemented('Blockchain document querying endpoint planned for Day 8-10')
})
