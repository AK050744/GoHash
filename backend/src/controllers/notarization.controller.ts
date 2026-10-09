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
 * GET /api/notarization/pending (NOTARY)
 * Returns all REQUESTED notarizations with document {id, originalName, sha256Hash, createdAt}
 * and owner {name} (no email).
 */
export const getPendingNotarizations = asyncHandler(async (_req: Request, res: Response) => {
  const notarizations = await NotarizationService.getPendingNotarizations()
  sendSuccess(res, { notarizations }, 200)
})

/**
 * GET /api/notarization/:id (NOTARY, or the requesting owner; others 404)
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
 * Body: { reason: string } (required -> 400 REASON_REQUIRED)
 * Only allowed from REQUESTED or APPROVED.
 * Sets Notarization → REJECTED and Document → REJECTED.
 */
export const rejectNotarization = asyncHandler(async (req: Request, res: Response) => {
  const { reason } = req.body
  if (!reason || typeof reason !== 'string' || !reason.trim()) {
    throw new ApiError(400, 'REASON_REQUIRED', 'reason is required')
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
 * Allowed from REQUESTED, APPROVED (retry), or FAILED.
 * Precondition checks:
 *   400 WALLET_NOT_LINKED         — notary has no linked wallet
 *   403 NOTARY_NOT_AUTHORIZED_ON_CHAIN — wallet not authorized on contract
 *   400 OWNER_WALLET_REQUIRED     — owner has no linked wallet
 *   409 ALREADY_NOTARIZED         — hash already on-chain
 * Sets APPROVED and returns { success, contractAddress, chainId, abi, method, args }.
 */
export const approveNotarization = asyncHandler(async (req: Request, res: Response) => {
  const result = await NotarizationService.approveNotarization(req.params.id, req.userId!)
  res.status(200).json(result)
})

/**
 * POST /api/notarization/:id/confirm (NOTARY who owns the request)
 * Body: { transactionHash: string }
 * Validates hash format.
 * Returns 202 { status: "TX_PENDING" } if not mined yet.
 * On success: sets CONFIRMED, Document NOTARIZED.
 * Reverted tx: sets FAILED with failureReason.
 * Other mismatch: 422 VERIFICATION_FAILED with specific reason.
 * Idempotent 200 when confirming an already CONFIRMED request with the same hash.
 */
export const confirmNotarization = asyncHandler(async (req: Request, res: Response) => {
  const { transactionHash } = req.body
  if (!transactionHash || typeof transactionHash !== 'string' || !/^0x[a-fA-F0-9]{64}$/.test(transactionHash)) {
    throw ApiError.badRequest('Invalid transaction hash format', 'VALIDATION_ERROR')
  }

  const { status, body } = await NotarizationService.confirmNotarization(
    req.params.id,
    req.userId!,
    transactionHash
  )

  res.status(status).json(body)
})
