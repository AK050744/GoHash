import { Router } from 'express'
import healthRoutes       from './health.routes'
import authRoutes         from './auth.routes'
import documentRoutes     from './document.routes'
import notarizationRoutes from './notarization.routes'
import verifyRoutes       from './verify.routes'
import blockchainRoutes   from './blockchain.routes'
import adminRoutes        from './admin.routes'
import configRoutes       from './config.routes'

const apiRouter = Router()

// Route groups mounted under /api
apiRouter.use('/health',       healthRoutes)
apiRouter.use('/auth',         authRoutes)
apiRouter.use('/documents',    documentRoutes)
apiRouter.use('/notarization', notarizationRoutes)
apiRouter.use('/verify',       verifyRoutes)
apiRouter.use('/blockchain',   blockchainRoutes)
apiRouter.use('/admin',        adminRoutes)
apiRouter.use('/config',       configRoutes)

export default apiRouter
