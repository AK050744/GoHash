import { Request, Response } from 'express'
import { ApiError } from '../utils/ApiError'
import { asyncHandler } from '../utils/asyncHandler'
import { NotarizationService } from '../services/notarization.service'
import { sendSuccess } from '../utils/response'

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
 * GET /api/notarization/pending (NOTARY, ADMIN)
 * Returns all REQUESTED notarizations with document + owner info.
 */
export const getPendingNotarizations = asyncHandler(async (_req: Request, res: Response) => {
  const notarizations = await NotarizationService.getPendingNotarizations()
  sendSuccess(res, { notarizations }, 200)
})

/**
 * GET /api/notarization/:id (NOTARY, ADMIN, or the requesting owner)
 * Returns a single notarization record.
 */
export const getNotarizationById = asyncHandler(async (req: Request, res: Response) => {
  const notarization = await NotarizationService.getNotarizationById(
    req.params.id,
    req.userId!,
    req.userRole!
  )
  sendSuccess(res, { notarization }, 200)
})

/**
 * POST /api/notarization/:id/reject (NOTARY)
 * Body: { reason: string } (required)
 * Sets Notarization → REJECTED and Document → REJECTED.
 */
export const rejectNotarization = asyncHandler(async (req: Request, res: Response) => {
  const { reason } = req.body
  if (!reason || !reason.trim()) {
    throw ApiError.badRequest('reason is required', 'VALIDATION_ERROR')
  }

  const notarization = await NotarizationService.rejectNotarization(
    req.params.id,
    req.userId!,
    reason
  )
  sendSuccess(res, { notarization }, 200)
})

/**
 * POST /api/notarization/:id/approve (NOTARY)
 * Precondition checks then sets APPROVED. Returns contract call args for frontend.
 * Error codes:
 *   400 WALLET_NOT_LINKED         — notary has no linked wallet
 *   403 NOTARY_NOT_AUTHORIZED_ON_CHAIN — wallet not authorized on contract
 *   400 OWNER_WALLET_REQUIRED     — owner has no linked wallet
 *   409 ALREADY_NOTARIZED         — hash already on-chain
 */
export const approveNotarization = asyncHandler(async (req: Request, res: Response) => {
  const result = await NotarizationService.approveNotarization(req.params.id, req.userId!)
  sendSuccess(res, result, 200)
})

/**
 * POST /api/notarization/:id/confirm (NOTARY)
 * Body: { transactionHash: string }
 * Verifies the on-chain receipt. Sets CONFIRMED + Document NOTARIZED on success.
 * Returns 202 TX_PENDING if not yet mined.
 * Sets FAILED on reverted tx.
 * Returns 422 VERIFICATION_FAILED on any mismatch.
 */
export const confirmNotarization = asyncHandler(async (req: Request, res: Response) => {
  const { transactionHash } = req.body
  if (!transactionHash || typeof transactionHash !== 'string') {
    throw ApiError.badRequest('transactionHash is required', 'VALIDATION_ERROR')
  }

  const { status, body } = await NotarizationService.confirmNotarization(
    req.params.id,
    transactionHash
  )

  res.status(status).json({ success: true, ...body })
})
