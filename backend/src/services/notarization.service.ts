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
 *   1. Validate hash format.
 *   2. Verify receipt via BlockchainService.verifyReceipt().
 *   3. On TX_PENDING → 202 { status: "TX_PENDING" }.
 *   4. On TX_REVERTED → set FAILED with failureReason.
 *   5. On other mismatch → 422 VERIFICATION_FAILED.
 *   6. On success → set CONFIRMED; Document → NOTARIZED.
 *   7. Idempotent: same txHash + CONFIRMED → re-return success.
 *
 * State Machine transitions:
 *   - Only allowed transitions permitted; any other → 409 INVALID_STATE.
 *   - Atomic updates via findOneAndUpdate with status condition.
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
    notaryWallet:    n.notaryWallet ?? null,
    documentHash:    n.documentHash,
    transactionHash: n.transactionHash ?? null,
    blockNumber:     n.blockNumber ?? null,
    contractAddress: n.contractAddress ?? null,
    chainId:         n.chainId ?? null,
    // on-chain timestamp: proves hash was recorded no later than this time (not authorship or creation time)
    onChainTimestamp: n.onChainTimestamp ?? null,
    rejectionReason: n.rejectionReason ?? null,
    failureReason:   n.failureReason ?? null,
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
   * Document includes { id, originalName, sha256Hash, createdAt }.
   * Owner includes { name } (strictly no email).
   */
  static async getPendingNotarizations() {
    const notarizations = await Notarization.find({ status: 'REQUESTED' })
      .populate('documentId')
      .populate('requestedBy', 'name')
      .sort({ createdAt: -1 })

    return notarizations.map((n) => {
      const doc = n.documentId as any
      const owner = n.requestedBy as any

      return {
        id:              n._id.toString(),
        documentId:      doc?._id ? doc._id.toString() : n.documentId.toString(),
        requestedBy:     owner?._id ? owner._id.toString() : n.requestedBy.toString(),
        notaryId:        n.notaryId?.toString() ?? null,
        notaryWallet:    n.notaryWallet ?? null,
        documentHash:    n.documentHash,
        transactionHash: n.transactionHash ?? null,
        blockNumber:     n.blockNumber ?? null,
        contractAddress: n.contractAddress ?? null,
        chainId:         n.chainId ?? null,
        // on-chain timestamp: proves hash was recorded no later than this time
        onChainTimestamp: n.onChainTimestamp ?? null,
        rejectionReason: n.rejectionReason ?? null,
        failureReason:   n.failureReason ?? null,
        status:          n.status,
        createdAt:       n.createdAt,
        updatedAt:       n.updatedAt,
        document: doc
          ? {
              id:           doc._id ? doc._id.toString() : doc.toString(),
              originalName: doc.originalName || '',
              sha256Hash:   doc.sha256Hash || n.documentHash,
              createdAt:    doc.createdAt || n.createdAt,
            }
          : null,
        owner: owner
          ? {
              name: owner.name || '',
            }
          : null, // strictly no email
      }
    })
  }

  /**
   * Get a single notarization record.
   * Accessible by: the requesting owner (by userId), NOTARY, or ADMIN; others 404.
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
      .populate('requestedBy', 'name')

    if (!n) {
      throw ApiError.notFound('Notarization not found', 'NOT_FOUND')
    }

    const isOwner      = n.requestedBy.toString() === userId || (n.requestedBy as any)?._id?.toString() === userId
    const isPrivileged = userRole === 'NOTARY' || userRole === 'ADMIN'

    if (!isOwner && !isPrivileged) {
      throw ApiError.notFound('Notarization not found', 'NOT_FOUND')
    }

    const doc = n.documentId as any
    const owner = n.requestedBy as any

    return {
      ...serializeNotarization(n),
      document: doc
        ? {
            id:           doc._id ? doc._id.toString() : doc.toString(),
            originalName: doc.originalName || '',
            sha256Hash:   doc.sha256Hash || n.documentHash,
            createdAt:    doc.createdAt || n.createdAt,
          }
        : null,
      owner: owner ? { name: owner.name || '' } : null,
    }
  }

  /**
   * Reject a notarization request.
   * Reason required (400 REASON_REQUIRED).
   * Only allowed from REQUESTED or APPROVED; otherwise 409 INVALID_STATE.
   * Sets Notarization → REJECTED and Document → REJECTED atomically.
   */
  static async rejectNotarization(
    notarizationId: string,
    notaryId: string,
    reason: string
  ) {
    if (!Types.ObjectId.isValid(notarizationId)) {
      throw ApiError.notFound('Notarization not found', 'NOT_FOUND')
    }

    if (!reason || typeof reason !== 'string' || !reason.trim()) {
      throw new ApiError(400, 'REASON_REQUIRED', 'Rejection reason is required')
    }

    const n = await Notarization.findById(notarizationId)
    if (!n) {
      throw ApiError.notFound('Notarization not found', 'NOT_FOUND')
    }

    if (n.status !== 'REQUESTED' && n.status !== 'APPROVED') {
      throw new ApiError(
        409,
        'INVALID_STATE',
        `Cannot reject a notarization in status: ${n.status}`
      )
    }

    // Atomic state update
    const updated = await Notarization.findOneAndUpdate(
      {
        _id: n._id,
        status: { $in: ['REQUESTED', 'APPROVED'] },
      },
      {
        $set: {
          status:          'REJECTED',
          notaryId:        new Types.ObjectId(notaryId),
          rejectionReason: reason.trim(),
        },
      },
      { new: true }
    )

    if (!updated) {
      throw new ApiError(409, 'INVALID_STATE', 'Notarization status cannot transition to REJECTED')
    }

    // Mark the document as REJECTED
    await DocumentModel.findByIdAndUpdate(updated.documentId, { status: 'REJECTED' })

    return serializeNotarization(updated)
  }

  /**
   * Approve a notarization request.
   * Allowed only from REQUESTED, APPROVED (retry) or FAILED; otherwise 409 INVALID_STATE.
   *
   * Preconditions (each with its own error code):
   *   - Notary has a linked wallet                 (400 WALLET_NOT_LINKED)
   *   - Wallet is authorized on-chain via isNotary (403 NOTARY_NOT_AUTHORIZED_ON_CHAIN)
   *   - Document owner has a linked wallet         (400 OWNER_WALLET_REQUIRED)
   *   - Document hash is not already on-chain      (409 ALREADY_NOTARIZED)
   *
   * On success: sets status APPROVED and returns
   *   { success, contractAddress, chainId, abi, method, args, notarization }
   */
  static async approveNotarization(notarizationId: string, notaryId: string) {
    if (!Types.ObjectId.isValid(notarizationId)) {
      throw ApiError.notFound('Notarization not found', 'NOT_FOUND')
    }

    const n = await Notarization.findById(notarizationId)
    if (!n) {
      throw ApiError.notFound('Notarization not found', 'NOT_FOUND')
    }

    if (n.status !== 'REQUESTED' && n.status !== 'APPROVED' && n.status !== 'FAILED') {
      throw new ApiError(
        409,
        'INVALID_STATE',
        `Cannot approve a notarization in status: ${n.status}`
      )
    }

    // 1. Notary must have a linked wallet (400 WALLET_NOT_LINKED)
    const notary = await User.findById(notaryId)
    if (!notary || !notary.walletAddress) {
      throw new ApiError(
        400,
        'WALLET_NOT_LINKED',
        'You must link a wallet address to your account before approving a notarization.'
      )
    }

    // 2. Wallet authorized on-chain via the read call (403 NOTARY_NOT_AUTHORIZED_ON_CHAIN)
    const isAuthorized = await BlockchainService.isNotaryAuthorized(notary.walletAddress)
    if (!isAuthorized) {
      throw new ApiError(
        403,
        'NOTARY_NOT_AUTHORIZED_ON_CHAIN',
        'Your wallet is not authorized as a notary on the smart contract.'
      )
    }

    // 3. Document owner has a linked wallet (400 OWNER_WALLET_REQUIRED)
    const doc = await DocumentModel.findById(n.documentId)
    if (!doc) {
      throw ApiError.notFound('Associated document not found', 'NOT_FOUND')
    }

    const owner = await User.findById(doc.ownerId)
    if (!owner || !owner.walletAddress) {
      throw new ApiError(
        400,
        'OWNER_WALLET_REQUIRED',
        'The document owner must link a wallet address before the document can be notarized.'
      )
    }

    // 4. Hash not already on-chain (409 ALREADY_NOTARIZED)
    const onChainRecord = await BlockchainService.getRecord(doc.sha256Hash)
    if (onChainRecord.exists) {
      throw new ApiError(
        409,
        'ALREADY_NOTARIZED',
        'This document hash has already been notarized on-chain.'
      )
    }

    // Get contract deployment info
    const contractInfo = BlockchainService.getContractInfo()

    // Atomic update to APPROVED
    const updated = await Notarization.findOneAndUpdate(
      {
        _id: n._id,
        status: { $in: ['REQUESTED', 'APPROVED', 'FAILED'] },
      },
      {
        $set: {
          status:       'APPROVED',
          notaryId:     new Types.ObjectId(notaryId),
          notaryWallet: notary.walletAddress.toLowerCase(),
        },
      },
      { new: true }
    )

    if (!updated) {
      throw new ApiError(409, 'INVALID_STATE', 'Notarization status cannot transition to APPROVED')
    }

    // Method and arguments matching DocumentNotary.sol notarize(bytes32,string,address)
    const bytes32Hash = `0x${doc.sha256Hash}`
    const ipfsCid     = doc.ipfsCid || ''
    const args        = [bytes32Hash, ipfsCid, owner.walletAddress]

    return {
      success:         true,
      contractAddress: contractInfo.address,
      chainId:         contractInfo.chainId,
      abi:             contractInfo.abi,
      method:          'notarize',
      args,
      notarization:    serializeNotarization(updated),
    }
  }

  /**
   * Confirm a notarization by verifying the submitted transactionHash on-chain.
   * Restricted to the NOTARY who owns the request.
   *
   * Validates hash format.
   * Returns 202 { status: "TX_PENDING" } if not yet mined.
   * On success: sets CONFIRMED, Document NOTARIZED.
   * On reverted tx: sets FAILED with failureReason.
   * On mismatch: throws 422 VERIFICATION_FAILED with specific reason (status unchanged).
   * Idempotent: same txHash confirmed twice → returns 200 with confirmed record.
   */
  static async confirmNotarization(
    notarizationId: string,
    notaryId: string,
    transactionHash: string
  ): Promise<{ status: 202 | 200; body: Record<string, unknown> }> {
    // 1. Validate transaction hash format (0x followed by 64 hex characters)
    if (!transactionHash || typeof transactionHash !== 'string' || !/^0x[a-fA-F0-9]{64}$/.test(transactionHash)) {
      throw ApiError.badRequest('Invalid transaction hash format', 'VALIDATION_ERROR')
    }

    if (!Types.ObjectId.isValid(notarizationId)) {
      throw ApiError.notFound('Notarization not found', 'NOT_FOUND')
    }

    const n = await Notarization.findById(notarizationId)
    if (!n) {
      throw ApiError.notFound('Notarization not found', 'NOT_FOUND')
    }

    // Idempotent: confirming an already CONFIRMED request with the same hash → idempotent 200
    if (n.status === 'CONFIRMED') {
      if (n.transactionHash?.toLowerCase() === transactionHash.toLowerCase()) {
        return {
          status: 200,
          body: {
            success: true,
            notarization: serializeNotarization(n),
          },
        }
      }
      throw new ApiError(409, 'INVALID_STATE', 'Notarization already confirmed with a different transaction hash')
    }

    // State machine: must be APPROVED or FAILED
    if (n.status !== 'APPROVED' && n.status !== 'FAILED') {
      throw new ApiError(
        409,
        'INVALID_STATE',
        `Cannot confirm a notarization in status: ${n.status}`
      )
    }

    // Restrict to the NOTARY who approved / owns the request
    if (n.notaryId && n.notaryId.toString() !== notaryId) {
      throw ApiError.forbidden('Only the assigned notary can confirm this notarization request', 'FORBIDDEN')
    }

    // Duplicate check: this transactionHash must not be used by any other confirmed notarization
    const duplicateTx = await Notarization.findOne({
      _id: { $ne: n._id },
      transactionHash: { $regex: new RegExp(`^${transactionHash}$`, 'i') },
      status: 'CONFIRMED',
    })
    if (duplicateTx) {
      throw new ApiError(422, 'VERIFICATION_FAILED', 'Transaction hash is already used by another confirmed notarization')
    }

    // Ensure notary wallet is recorded
    if (!n.notaryWallet) {
      throw new ApiError(400, 'WALLET_NOT_LINKED', 'Notarization has no notary wallet recorded')
    }

    // Load contract deployment info
    const contractInfo = BlockchainService.getContractInfo()

    // Verify the receipt on-chain through read-only provider
    const result = await BlockchainService.verifyReceipt(transactionHash, {
      contractAddress: contractInfo.address,
      chainId:         contractInfo.chainId,
      notaryWallet:    n.notaryWallet,
      documentHash:    n.documentHash,
    })

    // Transaction not mined yet → 202 TX_PENDING
    if (!result.valid && result.reason === 'TX_PENDING') {
      return {
        status: 202,
        body: {
          success: true,
          status:  'TX_PENDING',
          code:    'TX_PENDING',
          message: 'Transaction has not been mined yet. Try again shortly.',
        },
      }
    }

    // Reverted transaction → FAILED with failureReason
    if (!result.valid && result.reason === 'TX_REVERTED') {
      const updated = await Notarization.findOneAndUpdate(
        {
          _id: n._id,
          status: { $in: ['APPROVED', 'FAILED'] },
        },
        {
          $set: {
            status:          'FAILED',
            transactionHash,
            failureReason:   'Transaction reverted on-chain',
          },
        },
        { new: true }
      )
      return {
        status: 200,
        body: {
          success: true,
          notarization: serializeNotarization(updated || n),
        },
      }
    }

    // Any other mismatch → 422 VERIFICATION_FAILED with specific reason; status unchanged
    if (!result.valid) {
      throw new ApiError(422, 'VERIFICATION_FAILED', result.reason ?? 'Receipt verification failed')
    }

    // ─── Verification Success ───────────────────────────────────────────────
    // Save transactionHash, blockNumber, contractAddress, chainId, notaryWallet,
    // and on-chain timestamp (proves the hash was recorded no later than this time)
    const updated = await Notarization.findOneAndUpdate(
      {
        _id: n._id,
        status: { $in: ['APPROVED', 'FAILED'] },
      },
      {
        $set: {
          status:           'CONFIRMED',
          transactionHash,
          blockNumber:      result.blockNumber ?? null,
          contractAddress:  contractInfo.address,
          chainId:          contractInfo.chainId,
          notaryWallet:     n.notaryWallet.toLowerCase(),
          onChainTimestamp: result.timestamp ?? null,
          failureReason:    null,
        },
      },
      { new: true }
    )

    if (!updated) {
      const check = await Notarization.findById(n._id)
      if (check && check.status === 'CONFIRMED' && check.transactionHash?.toLowerCase() === transactionHash.toLowerCase()) {
        return {
          status: 200,
          body: {
            success: true,
            notarization: serializeNotarization(check),
          },
        }
      }
      throw new ApiError(409, 'INVALID_STATE', 'Notarization status cannot transition to CONFIRMED')
    }

    // Mark associated document as NOTARIZED
    await DocumentModel.findByIdAndUpdate(updated.documentId, { status: 'NOTARIZED' })

    return {
      status: 200,
      body: {
        success: true,
        notarization: serializeNotarization(updated),
      },
    }
  }
}
