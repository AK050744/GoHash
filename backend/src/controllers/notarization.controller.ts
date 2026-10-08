import { Request, Response } from 'express'
import { ApiError } from '../utils/ApiError'
import { asyncHandler } from '../utils/asyncHandler'
import { NotarizationService } from '../services/notarization.service'

/**
 * POST /api/notarization/request (USER)
 * Creates a notarization request for a document owned by the user.
 * Document must be PENDING and have no active requests.
 */
export const requestNotarization = asyncHandler(async (req: Request, res: Response) => {
  const { documentId } = req.body
  if (!documentId) {
    throw ApiError.badRequest('documentId is required in request body', 'VALIDATION_ERROR')
  }

  const notarization = await NotarizationService.requestNotarization(documentId, req.userId!)
  res.status(201).json({
    success: true,
    notarization,
  })
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
