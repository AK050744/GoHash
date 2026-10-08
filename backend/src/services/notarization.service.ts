/**
 * services/notarization.service.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Business logic for notarization request lifecycle.
 *
 * Approve flow:
 *   1. Check notary has a linked wallet.                (400 WALLET_NOT_LINKED)
 *   2. Check wallet is authorized on-chain via isNotary. (403 NOTARY_NOT_AUTHORIZED_ON_CHAIN)
 *   3. Check document owner has a linked wallet.        (400 OWNER_WALLET_REQUIRED)
 *   4. Check hash not already on-chain via exists().    (409 ALREADY_NOTARIZED)
 *   5. Set status APPROVED; return call args for frontend.
 *
 * Confirm flow:
 *   1. Verify receipt via BlockchainService.verifyReceipt().
 *   2. On TX_PENDING → 202.
 *   3. On TX_REVERTED → set FAILED.
 *   4. On other mismatch → 422 VERIFICATION_FAILED.
 *   5. On success → set CONFIRMED; Document → NOTARIZED.
 *   6. Idempotent: same txHash + CONFIRMED → re-return success.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { Types } from 'mongoose'
import { Notarization, INotarization } from '../models/Notarization'
import { DocumentModel } from '../models/Document'
import { User } from '../models/User'
import { ApiError } from '../utils/ApiError'
import { BlockchainService } from './blockchain.service'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function serializeNotarization(n: INotarization) {
  return {
    id:              n._id.toString(),
    documentId:      n.documentId.toString(),
    requestedBy:     n.requestedBy.toString(),
    notaryId:        n.notaryId?.toString() ?? null,
    notaryWallet:    n.notaryWallet,
    documentHash:    n.documentHash,
    transactionHash: n.transactionHash,
    blockNumber:     n.blockNumber,
    contractAddress: n.contractAddress,
    chainId:         n.chainId,
    onChainTimestamp: n.onChainTimestamp,
    rejectionReason: n.rejectionReason,
    failureReason:   n.failureReason,
    status:          n.status,
    createdAt:       n.createdAt,
    updatedAt:       n.updatedAt,
  }
}

// ─── NotarizationService ─────────────────────────────────────────────────────

export class NotarizationService {
  /**
   * Request notarization for a document.
   * Only the document owner can request notarization.
   * Document must be in PENDING status.
   * Cannot request if an active request already exists.
   */
  static async requestNotarization(documentId: string, userId: string) {
    if (!documentId || !Types.ObjectId.isValid(documentId)) {
      throw ApiError.notFound('Document not found', 'NOT_FOUND')
    }

    const doc = await DocumentModel.findById(documentId)
    if (!doc || doc.ownerId.toString() !== userId) {
      throw ApiError.notFound('Document not found', 'NOT_FOUND')
    }

    if (doc.status !== 'PENDING') {
      throw ApiError.badRequest('Document must be in PENDING status to request notarization', 'INVALID_STATUS')
    }

    // Check if an active request already exists
    const activeReq = await Notarization.findOne({
      documentId: doc._id,
      status: { $in: ['REQUESTED', 'APPROVED', 'CONFIRMED'] },
    })

    if (activeReq) {
      throw ApiError.conflict('An active notarization request already exists for this document', 'DUPLICATE_REQUEST')
    }

    const notarization = await Notarization.create({
      documentId: doc._id,
      requestedBy: userId,
      documentHash: doc.sha256Hash,
      status: 'REQUESTED',
    })

    return {
      id: notarization._id.toString(),
      documentId: notarization.documentId.toString(),
      status: notarization.status,
      documentHash: notarization.documentHash,
      requestedBy: notarization.requestedBy.toString(),
      createdAt: notarization.createdAt,
    }
  }

  /**
   * Get all pending (REQUESTED) notarizations with document + owner info.
   * For NOTARY or ADMIN consumption.
   */
  static async getPendingNotarizations() {
    const notarizations = await Notarization.find({ status: 'REQUESTED' })
      .populate('documentId')
      .populate('requestedBy', 'name email walletAddress')
      .sort({ createdAt: -1 })

    return notarizations.map((n) => serializeNotarization(n))
  }

  /**
   * Get a single notarization record.
   * Accessible by: the requesting owner (by userId), NOTARY, or ADMIN.
   */
  static async getNotarizationById(
    notarizationId: string,
    userId: string,
    userRole: string
  ) {
    if (!Types.ObjectId.isValid(notarizationId)) {
      throw ApiError.notFound('Notarization not found', 'NOT_FOUND')
    }

    const n = await Notarization.findById(notarizationId)
      .populate('documentId')
      .populate('requestedBy', 'name email walletAddress')

    if (!n) {
      throw ApiError.notFound('Notarization not found', 'NOT_FOUND')
    }

    const isOwner    = n.requestedBy.toString() === userId || (n.requestedBy as any)?._id?.toString() === userId
    const isPrivileged = userRole === 'NOTARY' || userRole === 'ADMIN'

    if (!isOwner && !isPrivileged) {
      throw ApiError.notFound('Notarization not found', 'NOT_FOUND')
    }

    return serializeNotarization(n)
  }

  /**
   * Reject a notarization request.
   * Sets Notarization → REJECTED and Document → REJECTED.
   */
  static async rejectNotarization(
    notarizationId: string,
    notaryId: string,
    reason: string
  ) {
    if (!Types.ObjectId.isValid(notarizationId)) {
      throw ApiError.notFound('Notarization not found', 'NOT_FOUND')
    }

    if (!reason || !reason.trim()) {
      throw ApiError.badRequest('Rejection reason is required', 'VALIDATION_ERROR')
    }

    const n = await Notarization.findById(notarizationId)
    if (!n) {
      throw ApiError.notFound('Notarization not found', 'NOT_FOUND')
    }

    if (n.status !== 'REQUESTED' && n.status !== 'APPROVED') {
      throw ApiError.badRequest(
        `Cannot reject a notarization in status: ${n.status}`,
        'INVALID_STATUS'
      )
    }

    n.status          = 'REJECTED'
    n.notaryId        = new Types.ObjectId(notaryId)
    n.rejectionReason = reason.trim()
    await n.save()

    // Also mark the document as REJECTED
    await DocumentModel.findByIdAndUpdate(n.documentId, { status: 'REJECTED' })

    return serializeNotarization(n)
  }

  /**
   * Approve a notarization request.
   *
   * Preconditions (each with a distinct error code):
   *   - Notary must have a linked wallet.           (400 WALLET_NOT_LINKED)
   *   - Wallet must be authorized on-chain.         (403 NOTARY_NOT_AUTHORIZED_ON_CHAIN)
   *   - Document owner must have a linked wallet.   (400 OWNER_WALLET_REQUIRED)
   *   - Document hash must not already be on-chain. (409 ALREADY_NOTARIZED)
   *
   * On success: sets status APPROVED and returns the call args for the frontend.
   */
  static async approveNotarization(notarizationId: string, notaryId: string) {
    if (!Types.ObjectId.isValid(notarizationId)) {
      throw ApiError.notFound('Notarization not found', 'NOT_FOUND')
    }

    const n = await Notarization.findById(notarizationId)
    if (!n) {
      throw ApiError.notFound('Notarization not found', 'NOT_FOUND')
    }

    if (n.status !== 'REQUESTED' && n.status !== 'FAILED') {
      throw ApiError.badRequest(
        `Cannot approve a notarization in status: ${n.status}`,
        'INVALID_STATUS'
      )
    }

    // Load notary's linked wallet
    const notary = await User.findById(notaryId)
    if (!notary || !notary.walletAddress) {
      throw ApiError.badRequest(
        'You must link a wallet address to your account before approving a notarization.',
        'WALLET_NOT_LINKED'
      )
    }

    // Check on-chain authorization
    let isAuthorized: boolean
    try {
      isAuthorized = await BlockchainService.isNotaryAuthorized(notary.walletAddress)
    } catch {
      throw ApiError.internal(
        'Could not verify notary authorization on-chain. Is the blockchain node running?',
        'BLOCKCHAIN_UNAVAILABLE'
      )
    }

    if (!isAuthorized) {
      throw ApiError.forbidden(
        'Your wallet is not authorized as a notary on the smart contract.',
        'NOTARY_NOT_AUTHORIZED_ON_CHAIN'
      )
    }

    // Load the document and its owner
    const doc = await DocumentModel.findById(n.documentId)
    if (!doc) {
      throw ApiError.notFound('Associated document not found', 'NOT_FOUND')
    }

    const owner = await User.findById(doc.ownerId)
    if (!owner || !owner.walletAddress) {
      throw ApiError.badRequest(
        'The document owner must link a wallet address before the document can be notarized.',
        'OWNER_WALLET_REQUIRED'
      )
    }

    // Check if the hash is already on-chain
    let alreadyExists: boolean
    try {
      alreadyExists = (await BlockchainService.getRecord(doc.sha256Hash)).exists
    } catch {
      throw ApiError.internal(
        'Could not check on-chain document state. Is the blockchain node running?',
        'BLOCKCHAIN_UNAVAILABLE'
      )
    }

    if (alreadyExists) {
      throw ApiError.conflict(
        'This document hash has already been notarized on-chain.',
        'ALREADY_NOTARIZED'
      )
    }

    // Get contract info for the response
    const contractInfo = BlockchainService.getContractInfo()

    // Set APPROVED with notary info
    n.status      = 'APPROVED'
    n.notaryId    = new Types.ObjectId(notaryId)
    n.notaryWallet = notary.walletAddress
    await n.save()

    // Build the bytes32 argument
    const bytes32Hash = `0x${doc.sha256Hash}`
    const ipfsCid     = doc.ipfsCid || ''

    return {
      notarization: serializeNotarization(n),
      contractAddress: contractInfo.address,
      chainId:         contractInfo.chainId,
      abi:             contractInfo.abi,
      method:          'notarize',
      args:            [bytes32Hash, ipfsCid, owner.walletAddress],
    }
  }

  /**
   * Confirm a notarization by verifying the submitted transactionHash on-chain.
   *
   * Returns 202 TX_PENDING if not yet mined.
   * Sets FAILED if tx reverted.
   * Returns 422 VERIFICATION_FAILED for any mismatch.
   * Idempotent: same txHash confirmed twice → returns success again.
   */
  static async confirmNotarization(
    notarizationId: string,
    transactionHash: string
  ): Promise<{ status: 202 | 200; body: Record<string, unknown> }> {
    if (!Types.ObjectId.isValid(notarizationId)) {
      throw ApiError.notFound('Notarization not found', 'NOT_FOUND')
    }

    const n = await Notarization.findById(notarizationId)
    if (!n) {
      throw ApiError.notFound('Notarization not found', 'NOT_FOUND')
    }

    // Idempotent: if already CONFIRMED with same txHash, return success
    if (n.status === 'CONFIRMED' && n.transactionHash === transactionHash) {
      return { status: 200, body: { notarization: serializeNotarization(n) } }
    }

    if (n.status !== 'APPROVED' && n.status !== 'FAILED') {
      throw ApiError.badRequest(
        `Cannot confirm a notarization in status: ${n.status}`,
        'INVALID_STATUS'
      )
    }

    // Check if another notarization already used this txHash
    const existingUse = await Notarization.findOne({
      transactionHash,
      _id: { $ne: n._id },
      status: 'CONFIRMED',
    })
    if (existingUse) {
      throw ApiError.conflict(
        'This transaction hash is already used by another confirmed notarization.',
        'DUPLICATE_TX'
      )
    }

    // Load contract info and notary wallet
    const contractInfo = BlockchainService.getContractInfo()

    if (!n.notaryWallet) {
      throw ApiError.badRequest('Notarization has no notary wallet recorded.', 'WALLET_NOT_LINKED')
    }

    // Verify the receipt on-chain
    const result = await BlockchainService.verifyReceipt(transactionHash, {
      contractAddress: contractInfo.address,
      chainId:         contractInfo.chainId,
      notaryWallet:    n.notaryWallet,
      documentHash:    n.documentHash,
    })

    // Not yet mined
    if (!result.valid && result.reason === 'TX_PENDING') {
      return {
        status: 202,
        body: {
          success: true,
          code:    'TX_PENDING',
          message: 'Transaction has not been mined yet. Try again shortly.',
        },
      }
    }

    // Reverted
    if (!result.valid && result.reason === 'TX_REVERTED') {
      n.status        = 'FAILED'
      n.transactionHash = transactionHash
      n.failureReason = 'Transaction reverted on-chain'
      await n.save()
      return {
        status: 200,
        body: { notarization: serializeNotarization(n) },
      }
    }

    // Other mismatch → 422 (throw so the route returns 422)
    if (!result.valid) {
      throw new ApiError(422, 'VERIFICATION_FAILED', result.reason ?? 'Receipt verification failed')
    }

    // ─── Success ─────────────────────────────────────────────────────────────

    n.status           = 'CONFIRMED'
    n.transactionHash  = transactionHash
    n.blockNumber      = result.blockNumber ?? null
    n.contractAddress  = contractInfo.address
    n.chainId          = contractInfo.chainId
    n.onChainTimestamp = result.timestamp ?? null
    n.failureReason    = null
    await n.save()

    // Update document status to NOTARIZED
    await DocumentModel.findByIdAndUpdate(n.documentId, { status: 'NOTARIZED' })

    return { status: 200, body: { notarization: serializeNotarization(n) } }
  }
}
