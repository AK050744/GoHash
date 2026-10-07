import { Request, Response } from 'express'
import { ApiError } from '../utils/ApiError'
import { asyncHandler } from '../utils/asyncHandler'

/**
 * POST /api/verify (Planned Day 11)
 */
export const verifyDocument = asyncHandler(async (_req: Request, _res: Response) => {
  throw ApiError.notImplemented('Document verification endpoint planned for Day 11')
})
