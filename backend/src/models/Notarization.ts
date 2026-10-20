import { Schema, model, Document as MongooseDocument, Types } from 'mongoose'

export type NotarizationStatus = 'REQUESTED' | 'APPROVED' | 'REJECTED' | 'CONFIRMED' | 'FAILED'

export interface INotarizationPayment {
  transactionHash: string
  payer: string
  recipient: string
  amountWei: string
  blockNumber: number
  status: 'PAID'
  paidAt: Date
  refundDue: boolean
}

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
  onChainTimestamp?: number | null  // block.timestamp from DocumentNotarized event: proves hash was recorded no later than this time (not authorship/creation time)
  rejectionReason?: string | null
  failureReason?: string | null     // set when a confirm tx is reverted
  // Unique 16-character hex lookup code derived from on-chain data (not stored in the contract)
  notarizationKey?: string | null
  payment?: INotarizationPayment | null
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
      index: true, // indexed to detect duplicate txHash across notarizations
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
    onChainTimestamp: {
      type: Number,
      default: null,
    },
    rejectionReason: {
      type: String,
      default: null,
    },
    failureReason: {
      type: String,
      default: null,
    },
    // The key is a lookup code derived from on-chain data, not stored in the contract.
    // Stored as the raw 16 uppercase hex characters. Display format GH-XXXX-XXXX-XXXX-XXXX.
    notarizationKey: {
      type: String,
      uppercase: true,
      trim: true,
    },
    // Fee payment details in test ETH verified on-chain by backend read-only provider
    payment: {
      transactionHash: {
        type: String,
        lowercase: true,
        trim: true,
      },
      payer: {
        type: String,
        lowercase: true,
        trim: true,
      },
      recipient: {
        type: String,
        lowercase: true,
        trim: true,
      },
      amountWei: {
        type: String,
        trim: true,
      },
      blockNumber: {
        type: Number,
      },
      status: {
        type: String,
        enum: ['PAID'],
      },
      paidAt: {
        type: Date,
      },
      refundDue: {
        type: Boolean,
        default: false,
      },
    },
    status: {
      type: String,
      enum: ['REQUESTED', 'APPROVED', 'REJECTED', 'CONFIRMED', 'FAILED'],
      default: 'REQUESTED',
    },
  },
  { timestamps: true }
)

// Sparse unique index on notarizationKey so multiple null values are allowed
NotarizationSchema.index({ notarizationKey: 1 }, { unique: true, sparse: true })
// Sparse unique index on payment.transactionHash to prevent payment reuse
NotarizationSchema.index({ 'payment.transactionHash': 1 }, { unique: true, sparse: true })

export const Notarization = model<INotarization>('Notarization', NotarizationSchema)
