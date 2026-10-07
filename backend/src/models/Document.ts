import { Schema, model, Document as MongooseDocument, Types } from 'mongoose'

export type DocumentVisibility = 'PRIVATE' | 'PUBLIC'
export type DocumentStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'NOTARIZED'

export interface IDocument extends MongooseDocument {
  _id: Types.ObjectId
  ownerId: Types.ObjectId
  fileName: string
  originalName: string
  mimeType: string
  fileSize: number
  sha256Hash: string
  storagePath: string
  ipfsCid: string | null
  visibility: DocumentVisibility
  status: DocumentStatus
  createdAt: Date
  updatedAt: Date
}

const DocumentSchema = new Schema<IDocument>(
  {
    ownerId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Owner ID is required'],
      index: true,
    },
    fileName: {
      type: String,
      required: [true, 'File name is required'],
      trim: true,
    },
    originalName: {
      type: String,
      required: [true, 'Original file name is required'],
      trim: true,
    },
    mimeType: {
      type: String,
      default: 'application/octet-stream',
    },
    fileSize: {
      type: Number,
      default: 0,
    },
    sha256Hash: {
      type: String,
      required: [true, 'SHA-256 hash is required'],
      lowercase: true,
      trim: true,
      match: [/^[a-f0-9]{64}$/, 'Invalid SHA-256 hash: must be 64 hexadecimal characters'],
      index: true,
    },
    storagePath: {
      type: String,
      default: '',
    },
    ipfsCid: {
      type: String,
      default: null,
    },
    visibility: {
      type: String,
      enum: ['PRIVATE', 'PUBLIC'],
      default: 'PRIVATE',
    },
    status: {
      type: String,
      enum: ['PENDING', 'APPROVED', 'REJECTED', 'NOTARIZED'],
      default: 'PENDING',
    },
  },
  { timestamps: true }
)

// Unique compound index on (ownerId, sha256Hash) to prevent duplicate uploads by the same owner
DocumentSchema.index({ ownerId: 1, sha256Hash: 1 }, { unique: true })

export const DocumentModel = model<IDocument>('Document', DocumentSchema)
// Also export as Document for standard naming convention
export { DocumentModel as Document }
