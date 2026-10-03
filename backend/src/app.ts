import express, { Application, Request, Response } from 'express'
import cors from 'cors'
import morgan from 'morgan'
import { env } from './config/env'

// ─── Route Imports ────────────────────────────────────────────────────────────
import authRoutes     from './routes/auth.routes'
import documentRoutes from './routes/document.routes'
import userRoutes     from './routes/user.routes'

// ─── Middleware Imports ───────────────────────────────────────────────────────
import { errorHandler }  from './middlewares/error.middleware'
import { notFoundHandler } from './middlewares/notFound.middleware'

const app: Application = express()

// ─── Global Middlewares ───────────────────────────────────────────────────────
app.use(cors({ origin: env.CORS_ORIGIN, credentials: true }))
app.use(express.json())
app.use(express.urlencoded({ extended: true }))
if (env.NODE_ENV !== 'test') {
  app.use(morgan('dev'))
}

// ─── Health Check ─────────────────────────────────────────────────────────────
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// ─── API Routes ───────────────────────────────────────────────────────────────
app.use('/api/auth',      authRoutes)
app.use('/api/documents', documentRoutes)
app.use('/api/users',     userRoutes)

// ─── Error Handlers ───────────────────────────────────────────────────────────
app.use(notFoundHandler)
app.use(errorHandler)

export default app
