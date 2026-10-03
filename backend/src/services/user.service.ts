import { User, IUser } from '../models/User.model'
import { Types } from 'mongoose'

export class UserService {
  static async findById(id: string): Promise<IUser | null> {
    return User.findById(new Types.ObjectId(id))
  }

  static async updateWallet(userId: string, walletAddress: string): Promise<IUser | null> {
    return User.findByIdAndUpdate(userId, { walletAddress }, { new: true })
  }
}
