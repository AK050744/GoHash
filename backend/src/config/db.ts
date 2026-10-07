import mongoose from 'mongoose'
import { env } from './env'

let isConnected = false
let isShuttingDown = false
let memoryServerInstance: any = null

/**
 * Connect to MongoDB using Mongoose with event listeners.
 * In development and test environments, falls back to MongoMemoryServer
 * if a local MongoDB daemon is not reachable.
 */
export async function connectDB(uri?: string): Promise<typeof mongoose> {
  const targetUri = uri || env.MONGODB_URI

  try {
    const conn = await mongoose.connect(targetUri, {
      serverSelectionTimeoutMS: 3000,
    })
    isConnected = true
    console.log(`✅ MongoDB connected: ${conn.connection.host || 'localhost'}`)
    return conn
  } catch (error: any) {
    // If local daemon is not running in dev/test, use MongoMemoryServer fallback
    if (
      env.NODE_ENV !== 'production' &&
      (error.name === 'MongooseServerSelectionError' || error.message?.includes('ECONNREFUSED'))
    ) {
      console.warn(`⚠️  Cannot reach ${targetUri}. Initializing local in-memory MongoDB...`)
      try {
        const { MongoMemoryServer } = await import('mongodb-memory-server')
        memoryServerInstance = await MongoMemoryServer.create()
        const memoryUri = memoryServerInstance.getUri()
        const conn = await mongoose.connect(memoryUri)
        isConnected = true
        console.log(`✅ MongoDB connected: ${conn.connection.host || 'localhost'} (in-memory)`)
        return conn
      } catch (memErr) {
        console.error('❌ In-memory MongoDB startup failed:', memErr)
      }
    }

    console.error('❌ MongoDB connection error:', error)
    throw error
  }
}

/**
 * Gracefully disconnect Mongoose connection and shutdown memory server if active.
 */
export async function disconnectDB(): Promise<void> {
  if (!isConnected && !memoryServerInstance) return
  try {
    await mongoose.connection.close()
    isConnected = false
    if (memoryServerInstance) {
      await memoryServerInstance.stop()
      memoryServerInstance = null
    }
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
  isConnected = false
  if (!isShuttingDown) {
    console.warn('⚠️  MongoDB connection lost / disconnected')
  }
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
