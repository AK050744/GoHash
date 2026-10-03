import mongoose from 'mongoose'
import { env } from './env'

export async function connectDB(): Promise<void> {
  try {
    await mongoose.connect(env.MONGO_URI)
    console.log('✅ MongoDB connected:', mongoose.connection.host)
  } catch (error) {
    console.error('❌ MongoDB connection error:', error)
    process.exit(1)
  }
}

mongoose.connection.on('disconnected', () => {
  console.warn('⚠️  MongoDB disconnected')
})
