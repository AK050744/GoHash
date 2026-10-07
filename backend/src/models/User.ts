import { Schema, model, Document, Types } from 'mongoose'

export type UserRole = 'USER' | 'NOTARY' | 'ADMIN'

export interface IUser extends Document {
  _id: Types.ObjectId
  name: string
  email: string
  passwordHash: string
  role: UserRole
  walletAddress?: string | null
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

const UserSchema = new Schema<IUser>(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      maxlength: 100,
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    passwordHash: {
      type: String,
      required: [true, 'Password hash is required'],
      select: false, // Never returned in queries by default
    },
    role: {
      type: String,
      enum: ['USER', 'NOTARY', 'ADMIN'],
      default: 'USER',
    },
    walletAddress: {
      type: String,
      lowercase: true,
      trim: true,
      default: null,
      validate: {
        validator: function (val: string | null) {
          if (!val) return true
          return /^0x[a-f0-9]{40}$/.test(val)
        },
        message: 'Invalid Ethereum wallet address format (must be 0x followed by 40 hex characters)',
      },
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
)

export const User = model<IUser>('User', UserSchema)
