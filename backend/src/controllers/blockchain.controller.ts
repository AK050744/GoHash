import { Request, Response } from 'express'
import { Types } from 'mongoose'
import { ApiError } from '../utils/ApiError'
import { asyncHandler } from '../utils/asyncHandler'
import { sendSuccess } from '../utils/response'
import { Notarization } from '../models/Notarization'
import { DocumentModel } from '../models/Document'
import { BlockchainService } from '../services/blockchain.service'
import { FULL_NOTARY_ABI } from '../config/blockchain'
import { formatNotarizationKey } from '../utils/notarizationKey'
import { ensureNotarizationKeyForRecord } from '../services/notarization.service'

/**
 * GET /api/blockchain/contract (ADMIN only)
 * Returns the deployed contract address, chainId, and full ABI.
 * Used by the admin frontend to construct addNotary/removeNotary calls via MetaMask.
 *
 * SECURITY: The backend NEVER holds a private key or signer.
 * This endpoint only exposes read-only deployment metadata.
 */
export const getContractMeta = asyncHandler(async (_req: Request, res: Response) => {
  // getContractInfo() throws 503 CONTRACT_NOT_DEPLOYED if the deployment file is missing
  const info = BlockchainService.getContractInfo()

  // assertChainReachable() throws 503 CHAIN_UNREACHABLE if the node cannot be reached
  await BlockchainService.assertChainReachable()

  sendSuccess(res, {
    contractAddress: info.address,
    chainId:         info.chainId,
    abi:             FULL_NOTARY_ABI,
  }, 200)
})

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

  if (storedNotarization) {
    await ensureNotarizationKeyForRecord(storedNotarization)
  }

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
        notarizationKey:  storedNotarization.notarizationKey ? formatNotarizationKey(storedNotarization.notarizationKey) : null,
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
    notarizationKey: stored?.notarizationKey ?? null,
    stored,
    onChainRecord,
  }, 200)
})
