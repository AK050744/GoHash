import fs from 'fs'
import path from 'path'
import { Types } from 'mongoose'
import { DocumentModel, IDocument, DocumentStatus } from '../models/Document'
import { Notarization } from '../models/Notarization'
import { computeSha256 } from './hash.service'
import { ApiError } from '../utils/ApiError'


export class DocumentService {
  /**
   * Upload and process a PDF document.
   * Validates MIME type and '%PDF-' magic bytes, hashes buffer via SHA-256,
   * writes to backend/uploads/<documentId>.pdf, and creates Document record.
   */
  static async uploadDocument(userId: string, file?: Express.Multer.File) {
    if (!file) {
      throw ApiError.badRequest('No file provided for upload', 'INVALID_FILE')
    }

    const isPdfMime = file.mimetype?.toLowerCase() === 'application/pdf'
    const isPdfMagic =
      file.buffer &&
      file.buffer.length >= 5 &&
      file.buffer.subarray(0, 5).toString('ascii') === '%PDF-'

    if (!isPdfMime || !isPdfMagic) {
      throw ApiError.badRequest('File must be a valid PDF document with %PDF- header', 'INVALID_FILE')
    }

    const sha256Hash = computeSha256(file.buffer)

    // Check duplicate for this owner
    const existing = await DocumentModel.findOne({
      ownerId: userId,
      sha256Hash,
    })
    if (existing) {
      throw ApiError.conflict('Document with this SHA-256 hash already exists for this owner', 'DUPLICATE_DOCUMENT')
    }

    const documentId = new Types.ObjectId()
    const uploadsDir = path.resolve(process.cwd(), 'uploads')
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true })
    }

    const fileName = `${documentId}.pdf`
    const storagePath = path.join(uploadsDir, fileName)

    await fs.promises.writeFile(storagePath, file.buffer)

    try {
      const document = await DocumentModel.create({
        _id: documentId,
        ownerId: userId,
        fileName,
        originalName: file.originalname,
        mimeType: 'application/pdf',
        fileSize: file.size,
        sha256Hash,
        storagePath,
        status: 'PENDING',
        visibility: 'PRIVATE',
      })

      return {
        id: document._id.toString(),
        originalName: document.originalName,
        sha256Hash: document.sha256Hash,
        status: document.status,
        createdAt: document.createdAt,
      }
    } catch (err: any) {
      // Clean up file if database insertion fails
      if (fs.existsSync(storagePath)) {
        await fs.promises.unlink(storagePath).catch(() => {})
      }
      if (err.code === 11000) {
        throw ApiError.conflict('Document with this SHA-256 hash already exists for this owner', 'DUPLICATE_DOCUMENT')
      }
      throw err
    }
  }

  /**
   * Aggregate statistics for the authenticated user's documents.
   */
  static async getDocumentStats(userId: string) {
    const ownerId = new Types.ObjectId(userId)
    const [total, pending, notarized] = await Promise.all([
      DocumentModel.countDocuments({ ownerId }),
      DocumentModel.countDocuments({ ownerId, status: 'PENDING' }),
      DocumentModel.countDocuments({ ownerId, status: 'NOTARIZED' }),
    ])

    return { total, pending, notarized }
  }

  /**
   * Retrieve documents owned by the user, newest first, with optional status filter.
   */
  static async getDocuments(userId: string, statusFilter?: string) {
    const query: { ownerId: Types.ObjectId; status?: DocumentStatus } = {
      ownerId: new Types.ObjectId(userId),
    }

    if (statusFilter) {
      const upperStatus = statusFilter.toUpperCase() as DocumentStatus
      if (['PENDING', 'APPROVED', 'REJECTED', 'NOTARIZED'].includes(upperStatus)) {
        query.status = upperStatus
      }
    }

    const documents = await DocumentModel.find(query).sort({ createdAt: -1 })

    return documents.map((d: IDocument) => ({
      id: d._id.toString(),
      originalName: d.originalName,
      fileName: d.fileName,
      mimeType: d.mimeType,
      fileSize: d.fileSize,
      sha256Hash: d.sha256Hash,
      visibility: d.visibility,
      status: d.status,
      ipfsCid: d.ipfsCid,
      createdAt: d.createdAt,
      updatedAt: d.updatedAt,
    }))
  }

  /**
   * Get single document metadata. Accessible by owner, NOTARY, or ADMIN.
   * If not found or unauthorized, returns 404 so existence is not leaked.
   * Includes latest notarization record.
   */
  static async getDocumentById(documentId: string, userId: string, userRole: string) {
    if (!Types.ObjectId.isValid(documentId)) {
      throw ApiError.notFound('Document not found', 'NOT_FOUND')
    }

    const doc = await DocumentModel.findById(documentId)
    if (!doc) {
      throw ApiError.notFound('Document not found', 'NOT_FOUND')
    }

    const isOwner = doc.ownerId.toString() === userId
    const isPrivileged = userRole === 'NOTARY' || userRole === 'ADMIN'

    if (!isOwner && !isPrivileged) {
      throw ApiError.notFound('Document not found', 'NOT_FOUND')
    }

    // Fetch the latest (most recent) notarization for this document
    const notarizationDoc = await Notarization.findOne({ documentId: doc._id })
      .sort({ createdAt: -1 })
      .lean()

    const notarization = notarizationDoc
      ? {
          id:              notarizationDoc._id.toString(),
          status:          notarizationDoc.status,
          transactionHash: notarizationDoc.transactionHash ?? null,
          blockNumber:     notarizationDoc.blockNumber ?? null,
          notaryWallet:    notarizationDoc.notaryWallet ?? null,
          contractAddress: notarizationDoc.contractAddress ?? null,
          // on-chain timestamp: proves hash was recorded no later than this time
          timestamp:       notarizationDoc.onChainTimestamp ?? null,
          rejectionReason: notarizationDoc.rejectionReason ?? null,
        }
      : null

    return {
      id: doc._id.toString(),
      originalName: doc.originalName,
      fileName: doc.fileName,
      mimeType: doc.mimeType,
      fileSize: doc.fileSize,
      sha256Hash: doc.sha256Hash,
      visibility: doc.visibility,
      status: doc.status,
      ipfsCid: doc.ipfsCid,
      ownerId: doc.ownerId.toString(),
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
      notarization,
    }
  }


  /**
   * Get physical file path for streaming. Accessible by owner, NOTARY, or ADMIN.
   * If not found or unauthorized, returns 404.
   */
  static async getDocumentFile(documentId: string, userId: string, userRole: string) {
    if (!Types.ObjectId.isValid(documentId)) {
      throw ApiError.notFound('Document not found', 'NOT_FOUND')
    }

    const doc = await DocumentModel.findById(documentId)
    if (!doc) {
      throw ApiError.notFound('Document not found', 'NOT_FOUND')
    }

    const isOwner = doc.ownerId.toString() === userId
    const isPrivileged = userRole === 'NOTARY' || userRole === 'ADMIN'

    if (!isOwner && !isPrivileged) {
      throw ApiError.notFound('Document not found', 'NOT_FOUND')
    }

    const uploadsDir = path.resolve(process.cwd(), 'uploads')
    const filePath = doc.storagePath && fs.existsSync(doc.storagePath)
      ? doc.storagePath
      : path.join(uploadsDir, `${doc._id}.pdf`)

    if (!fs.existsSync(filePath)) {
      throw ApiError.notFound('Document file not found on disk', 'NOT_FOUND')
    }

    return { doc, filePath }
  }
}
