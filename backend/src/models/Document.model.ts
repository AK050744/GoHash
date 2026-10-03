import { Schema, model, Document, Types } from 'mongoose'

export type DocumentStatus = 'pending' | 'notarized' | 'failed'

export interface IDocument extends Document {
  _id:          Types.ObjectId
  owner:        Types.ObjectId          // ref → User
  fileName:     string
  mimeType:     string
  fileSize:     number                  // bytes
  documentHash: string                  // hex SHA-256 (0x...)
  description:  string
  status:       DocumentStatus
  txHash?:      string                  // on-chain tx hash
  blockNumber?: number
  notarizedAt?: Date
  createdAt:    Date
  updatedAt:    Date
}

const DocumentSchema = new Schema<IDocument>(
  {
    owner: {
      type:     Schema.Types.ObjectId,
      ref:      'User',
      required: true,
    },
    fileName: {
      type:     String,
      required: true,
      trim:     true,
    },
    mimeType: {
      type:    String,
      default: 'application/octet-stream',
    },
    fileSize: {
      type: Number,
      default: 0,
    },
    documentHash: {
      type:     String,
      required: true,
      unique:   true,
      index:    true,
    },
    description: {
      type:    String,
      default: '',
    },
    status: {
      type:    String,
      enum:    ['pending', 'notarized', 'failed'],
      default: 'pending',
    },
    txHash: {
      type:    String,
      default: null,
    },
    blockNumber: {
      type:    Number,
      default: null,
    },
    notarizedAt: {
      type:    Date,
      default: null,
    },
  },
  { timestamps: true }
)

export const NotarizedDocument = model<IDocument>('Document', DocumentSchema)
