import { Schema, model, Document as MongooseDocument, Types } from 'mongoose'

export type NotarizationStatus = 'REQUESTED' | 'APPROVED' | 'REJECTED' | 'CONFIRMED' | 'FAILED'

export interface INotarization extends MongooseDocument {
  _id: Types.ObjectId
  documentId: Types.ObjectId
  requestedBy: Types.ObjectId
  notaryId?: Types.ObjectId | null
  notaryWallet?: string | null
  documentHash: string
  transactionHash?: string | null
  blockNumber?: number | null
  contractAddress?: string | null
  chainId?: number | null
  rejectionReason?: string | null
  status: NotarizationStatus
  createdAt: Date
  updatedAt: Date
}

const NotarizationSchema = new Schema<INotarization>(
  {
    documentId: {
      type: Schema.Types.ObjectId,
      ref: 'Document',
      required: [true, 'Document ID is required'],
      index: true,
    },
    requestedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'RequestedBy User ID is required'],
      index: true,
    },
    notaryId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    notaryWallet: {
      type: String,
      lowercase: true,
      trim: true,
      default: null,
    },
    documentHash: {
      type: String,
      required: [true, 'Document hash is required'],
      index: true,
    },
    transactionHash: {
      type: String,
      default: null,
    },
    blockNumber: {
      type: Number,
      default: null,
    },
    contractAddress: {
      type: String,
      default: null,
    },
    chainId: {
      type: Number,
      default: null,
    },
    rejectionReason: {
      type: String,
      default: null,
    },
    status: {
      type: String,
      enum: ['REQUESTED', 'APPROVED', 'REJECTED', 'CONFIRMED', 'FAILED'],
      default: 'REQUESTED',
    },
  },
  { timestamps: true }
)

export const Notarization = model<INotarization>('Notarization', NotarizationSchema)
