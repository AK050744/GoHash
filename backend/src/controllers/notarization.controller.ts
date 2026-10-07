import { Request, Response } from 'express'
import { ApiError } from '../utils/ApiError'
import { asyncHandler } from '../utils/asyncHandler'

/**
 * POST /api/notarization/request (Planned Day 9-10)
 */
export const requestNotarization = asyncHandler(async (_req: Request, _res: Response) => {
  throw ApiError.notImplemented('Notarization request endpoint planned for Day 9-10')
})

/**
 * GET /api/notarization/pending (Planned Day 9-10)
 */
export const getPendingNotarizations = asyncHandler(async (_req: Request, _res: Response) => {
  throw ApiError.notImplemented('Pending notarizations endpoint planned for Day 9-10')
})

/**
 * POST /api/notarization/:id/approve (Planned Day 9-10)
 */
export const approveNotarization = asyncHandler(async (_req: Request, _res: Response) => {
  throw ApiError.notImplemented('Notarization approval endpoint planned for Day 9-10')
})

/**
 * POST /api/notarization/:id/reject (Planned Day 9-10)
 */
export const rejectNotarization = asyncHandler(async (_req: Request, _res: Response) => {
  throw ApiError.notImplemented('Notarization rejection endpoint planned for Day 9-10')
})
