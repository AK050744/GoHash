import mongoose from 'mongoose'
import { env } from './env'

let isConnected = false
let isShuttingDown = false

/**
 * Mask credentials in MongoDB connection string.
 */
function maskMongoUri(uri: string): string {
  try {
    const parsed = new URL(uri)
    if (parsed.password) {
      parsed.password = '***'
      return parsed.toString()
    }
    return uri
  } catch {
    return uri.replace(/(mongodb(?:\+srv)?:\/\/[^:]+:)[^@]+(@)/, '$1***$2')
  }
}

/**
 * Connect to MongoDB using Mongoose with event listeners.
 */
export async function connectDB(uri?: string): Promise<typeof mongoose> {
  const targetUri = uri || env.MONGODB_URI
  const maskedUri = maskMongoUri(targetUri)

  try {
    const conn = await mongoose.connect(targetUri, {
      serverSelectionTimeoutMS: 5000,
    })
    isConnected = true
    console.log(`✅ MongoDB connected: ${conn.connection.host || 'localhost'}`)
    return conn
  } catch (_error: any) {
    throw new Error(`MongoDB not reachable at ${maskedUri}. Start it with: docker start gohash-mongo`)
  }
}

/**
 * Gracefully disconnect Mongoose connection.
 */
export async function disconnectDB(): Promise<void> {
  if (!isConnected && mongoose.connection.readyState === 0) return
  try {
    await mongoose.connection.close()
    isConnected = false
    console.log('🔌 MongoDB connection closed gracefully')
  } catch (error) {
    console.error('❌ Error closing MongoDB connection:', error)
  }
}

/**
 * Return current MongoDB connection status.
 */
export function getDbState(): { state: number; status: string } {
  const state = mongoose.connection.readyState
  const statusMap: Record<number, string> = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting',
  }
  return {
    state,
    status: statusMap[state] || 'unknown',
  }
}

// ─── Connection Lifecycle Listeners ──────────────────────────────────────────
mongoose.connection.on('disconnected', () => {
  if (isConnected && !isShuttingDown) {
    console.warn('⚠️  MongoDB connection lost / disconnected')
  }
  isConnected = false
})

mongoose.connection.on('error', (err) => {
  if (isConnected) {
    console.error('❌ MongoDB runtime error:', err)
  }
})

// ─── Graceful Shutdown Handlers ──────────────────────────────────────────────
async function handleGracefulShutdown(signal: string): Promise<void> {
  if (isShuttingDown) return
  isShuttingDown = true
  console.log(`\n🛑 Received ${signal}. Closing MongoDB connection...`)
  await disconnectDB()
  process.exit(0)
}

process.once('SIGINT', () => handleGracefulShutdown('SIGINT'))
process.once('SIGTERM', () => handleGracefulShutdown('SIGTERM'))
