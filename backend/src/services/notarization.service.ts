import { Types } from 'mongoose'
import { Notarization } from '../models/Notarization'
import { DocumentModel } from '../models/Document'
import { ApiError } from '../utils/ApiError'

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
}
