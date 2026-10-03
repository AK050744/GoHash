import { Schema, model, Document, Types } from 'mongoose'

export interface IUser extends Document {
  _id:       Types.ObjectId
  name:      string
  email:     string
  password:  string          // bcrypt hash
  walletAddress?: string     // Ethereum address (optional)
  createdAt: Date
  updatedAt: Date
}

const UserSchema = new Schema<IUser>(
  {
    name: {
      type:     String,
      required: [true, 'Name is required'],
      trim:     true,
      maxlength: 100,
    },
    email: {
      type:     String,
      required: [true, 'Email is required'],
      unique:   true,
      lowercase: true,
      trim:     true,
    },
    password: {
      type:     String,
      required: [true, 'Password is required'],
      minlength: 8,
      select:   false,       // never returned in queries by default
    },
    walletAddress: {
      type:    String,
      trim:    true,
      default: null,
    },
  },
  { timestamps: true }
)

export const User = model<IUser>('User', UserSchema)
