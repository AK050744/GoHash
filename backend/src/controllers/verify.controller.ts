/**
 * controllers/verify.controller.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * POST /api/verify  (public — no login required)
 *
 * Accepts a PDF via multipart field "file".
 * Validates PDF (MIME + %PDF- header, MAX_FILE_SIZE_MB).
 * Computes SHA-256 in memory — the file is NEVER stored.
 * Looks up the hash on-chain via the read-only BlockchainService.
 *
 * FOUND:
 *   { success:true, status:"VERIFIED", hash, record:{ownerWallet, notaryWallet,
 *     timestamp, contractAddress, transactionHash?, blockNumber?},
 *     document?:{id, originalName} }
 *   transactionHash, blockNumber and document are added ONLY when a CONFIRMED
 *   notarization for this hash exists in MongoDB — otherwise omitted.
 *
 * NOT FOUND:
 *   { success:true, status:"NOT_VERIFIED", hash,
 *     message:"No notarization record matches this file's hash." }
 *
 * ERRORS:
 *   400 INVALID_FILE    — not a PDF or exceeds size limit
 *   503 CHAIN_UNREACHABLE  — chain could not be read
 *   503 CONTRACT_NOT_DEPLOYED — contract missing
 *
 * PRIVACY: Owner email, owner name, and any private-user data are NEVER returned.
 *
 * WORDING: The on-chain timestamp means "recorded no later than this time".
 * NOT_VERIFIED means the file differs from every notarized record (modified
 * after notarization, or never notarized).
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { Request, Response } from 'express'
import { asyncHandler } from '../utils/asyncHandler'
import { ApiError } from '../utils/ApiError'
import { computeSha256 } from '../services/hash.service'
import { BlockchainService } from '../services/blockchain.service'
import { Notarization } from '../models/Notarization'
import { env } from '../config/env'

/**
 * Internal helper to query on-chain notarization status and supplement
 * with MongoDB metadata if confirmed.
 */
async function lookupVerificationRecord(hash: string, notFoundMessage: string) {
  // Query on-chain (throws 503 on infra error)
  const onChain = await BlockchainService.getRecord(hash)

  // Not found on-chain
  if (!onChain.exists) {
    return {
      status: 200,
      body: {
        success: true,
        status:  'NOT_VERIFIED',
        hash,
        message: notFoundMessage,
      },
    }
  }

  // Found on-chain — look up MongoDB for extra metadata
  let txHash: string | undefined
  let blockNumber: number | undefined
  let documentInfo: { id: string; originalName: string } | undefined

  try {
    const dbRecord = await Notarization.findOne({
      documentHash: hash,
      status: 'CONFIRMED',
    })
      .sort({ updatedAt: -1 })
      .populate<{ documentId: { _id: any; originalName: string } }>('documentId', 'originalName')
      .lean()

    if (dbRecord) {
      if (dbRecord.transactionHash) txHash       = dbRecord.transactionHash
      if (dbRecord.blockNumber)     blockNumber   = dbRecord.blockNumber

      const populated = dbRecord.documentId as any
      if (populated && typeof populated === 'object' && populated.originalName) {
        documentInfo = {
          id:           populated._id.toString(),
          originalName: populated.originalName,
        }
      }
    }
  } catch {
    // MongoDB lookup failure is non-fatal; on-chain data is still valid
  }

  // Build record — uses on-chain data as the authoritative source
  const record: Record<string, unknown> = {
    ownerWallet:     onChain.owner,
    notaryWallet:    onChain.notary,
    timestamp:       onChain.timestamp,
    contractAddress: BlockchainService.getContractInfo().address,
  }

  if (txHash) record.transactionHash = txHash
  if (blockNumber !== undefined) record.blockNumber = blockNumber

  const body: Record<string, unknown> = {
    success: true,
    status:  'VERIFIED',
    hash,
    record,
  }

  if (documentInfo) {
    body.document = documentInfo
  }

  return { status: 200, body }
}

/**
 * POST /api/verify
 * Public endpoint — no authentication required.
 * Rate-limited at the route level.
 */
export const verifyDocument = asyncHandler(async (req: Request, res: Response) => {
  // ── 1. File presence ────────────────────────────────────────────────────────
  if (!req.file) {
    throw ApiError.badRequest('No file provided. Send a PDF via multipart field "file"', 'INVALID_FILE')
  }

  // ── 2. PDF validation (same checks as upload) ───────────────────────────────
  const { file } = req

  if (file.size > env.MAX_FILE_SIZE_MB * 1024 * 1024) {
    throw ApiError.badRequest(
      `File size exceeds the limit of ${env.MAX_FILE_SIZE_MB} MB`,
      'FILE_TOO_LARGE'
    )
  }

  const isPdfMime  = file.mimetype?.toLowerCase() === 'application/pdf'
  const isPdfMagic =
    file.buffer &&
    file.buffer.length >= 5 &&
    file.buffer.subarray(0, 5).toString('ascii') === '%PDF-'

  if (!isPdfMime || !isPdfMagic) {
    throw ApiError.badRequest(
      'File must be a valid PDF document with %PDF- header',
      'INVALID_FILE'
    )
  }

  // ── 3. Compute SHA-256 (server-side only; file is never stored) ────────────
  const hash = computeSha256(file.buffer)

  // ── 4. Verify against chain and DB ─────────────────────────────────────────
  const { status, body } = await lookupVerificationRecord(hash, "No notarization record matches this file's hash.")
  res.status(status).json(body)
})

/**
 * GET /api/verify/hash/:sha256
 * Public endpoint — verify directly by SHA-256 hex string.
 * Rate-limited at the route level.
 */
export const verifyHash = asyncHandler(async (req: Request, res: Response) => {
  let hash = req.params.sha256
  if (!hash || typeof hash !== 'string') {
    throw ApiError.badRequest('SHA-256 hash parameter is required', 'INVALID_HASH')
  }

  hash = hash.trim().toLowerCase()
  if (hash.startsWith('0x')) {
    hash = hash.slice(2)
  }

  if (!/^[a-f0-9]{64}$/.test(hash)) {
    throw ApiError.badRequest('Invalid SHA-256 hash format. Must be a 64-character hexadecimal string.', 'INVALID_HASH')
  }

  const { status, body } = await lookupVerificationRecord(hash, 'No notarization record matches this hash.')
  res.status(status).json(body)
})
