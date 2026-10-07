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
app.use(cors({ origin: env.CORS_ORIGIN, credentials: true }))

// ─── Request Body Parsers ────────────────────────────────────────────────────
const bodyLimit = `${env.MAX_FILE_SIZE_MB}mb`
app.use(express.json({ limit: bodyLimit }))
app.use(express.urlencoded({ extended: true, limit: bodyLimit }))

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
