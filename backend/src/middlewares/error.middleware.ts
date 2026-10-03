import { Request, Response, NextFunction } from 'express'

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  console.error('[Error]', err.message)

  // Mongoose duplicate key
  if ((err as any).code === 11000) {
    res.status(409).json({ message: 'Duplicate field value' })
    return
  }

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    res.status(400).json({ message: err.message })
    return
  }

  res.status(500).json({
    message: 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  })
}
