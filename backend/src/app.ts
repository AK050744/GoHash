import express, { Application } from 'express'
import cors from 'cors'
import helmet from 'helmet'
import morgan from 'morgan'
import { env } from './config/env'
import apiRouter from './routes'
import { errorHandler } from './middleware/error.middleware'
import { notFoundHandler } from './middleware/notFound.middleware'

const app: Application = express()

// ─── Security & HTTP Headers ──────────────────────────────────────────────────
app.use(helmet())

// ─── Cross-Origin Resource Sharing ───────────────────────────────────────────
const allowedOrigins = env.CORS_ORIGIN.split(',').map((o) => o.trim())
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g. mobile apps, curl, server-to-server)
      if (!origin) return callback(null, true)
      if (
        allowedOrigins.includes(origin) ||
        allowedOrigins.includes('*') ||
        (env.NODE_ENV === 'development' && /^http:\/\/localhost:\d+$/.test(origin))
      ) {
        return callback(null, true)
      }
      return callback(new Error(`CORS origin not allowed: ${origin}`))
    },
    credentials: true,
  }),
)

// ─── Request Body Parsers ────────────────────────────────────────────────────
const jsonBodyLimit = '1mb'
app.use(express.json({ limit: jsonBodyLimit }))
app.use(express.urlencoded({ extended: true, limit: jsonBodyLimit }))

// ─── Request Logging ─────────────────────────────────────────────────────────
if (env.NODE_ENV !== 'test') {
  app.use(morgan('dev'))
}

// ─── API Routes ───────────────────────────────────────────────────────────────
app.use('/api', apiRouter)

// ─── 404 & Centralized Error Handlers ─────────────────────────────────────────
app.use(notFoundHandler)
app.use(errorHandler)

export default app
