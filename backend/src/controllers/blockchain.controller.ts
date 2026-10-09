import { Request, Response } from 'express'
import { Types } from 'mongoose'
import { ApiError } from '../utils/ApiError'
import { asyncHandler } from '../utils/asyncHandler'
import { sendSuccess } from '../utils/response'
import { Notarization } from '../models/Notarization'
import { DocumentModel } from '../models/Document'
import { BlockchainService } from '../services/blockchain.service'

/**
 * GET /api/blockchain/:documentId (owner, NOTARY, ADMIN; others 404)
 * Returns { stored notarization, onChainRecord from getRecord } or onChainRecord null.
 */
export const getBlockchainDocument = asyncHandler(async (req: Request, res: Response) => {
  const { documentId } = req.params
  const userId   = req.userId!
  const userRole = req.userRole!

  if (!Types.ObjectId.isValid(documentId)) {
    throw ApiError.notFound('Document not found', 'NOT_FOUND')
  }

  const doc = await DocumentModel.findById(documentId)
  if (!doc) {
    throw ApiError.notFound('Document not found', 'NOT_FOUND')
  }

  const isOwner      = doc.ownerId.toString() === userId
  const isPrivileged = userRole === 'NOTARY' || userRole === 'ADMIN'

  if (!isOwner && !isPrivileged) {
    throw ApiError.notFound('Document not found', 'NOT_FOUND')
  }

  // Load stored notarization record
  const storedNotarization = await Notarization.findOne({ documentId: doc._id })
    .sort({ createdAt: -1 })
    .lean()

  // Query live on-chain state via read-only provider
  let onChainRecord: Record<string, unknown> | null = null
  try {
    const record = await BlockchainService.getRecord(doc.sha256Hash)
    if (record.exists) {
      onChainRecord = {
        exists:       true,
        documentHash: record.documentHash,
        ipfsCid:      record.ipfsCid,
        owner:        record.owner,
        notary:       record.notary,
        // on-chain timestamp: proves hash was recorded no later than this time
        timestamp:    record.timestamp,
      }
    } else {
      onChainRecord = null
    }
  } catch {
    // Node unreachable or contract not deployed — return stored data with null onChainRecord
    onChainRecord = null
  }

  const stored = storedNotarization
    ? {
        id:               storedNotarization._id.toString(),
        documentId:       storedNotarization.documentId.toString(),
        documentHash:     storedNotarization.documentHash,
        status:           storedNotarization.status,
        transactionHash:  storedNotarization.transactionHash ?? null,
        blockNumber:      storedNotarization.blockNumber ?? null,
        notaryWallet:     storedNotarization.notaryWallet ?? null,
        contractAddress:  storedNotarization.contractAddress ?? null,
        chainId:          storedNotarization.chainId ?? null,
        // on-chain timestamp: proves hash was recorded no later than this time
        timestamp:        storedNotarization.onChainTimestamp ?? null,
        rejectionReason:  storedNotarization.rejectionReason ?? null,
        failureReason:    storedNotarization.failureReason ?? null,
      }
    : null

  sendSuccess(res, {
    document: {
      id:         doc._id.toString(),
      sha256Hash: doc.sha256Hash,
      status:     doc.status,
      ipfsCid:    doc.ipfsCid,
    },
    stored,
    onChainRecord,
  }, 200)
})
