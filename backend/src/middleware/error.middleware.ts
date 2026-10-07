import { Request, Response, NextFunction } from 'express'
import { ZodError } from 'zod'
import { ApiError } from '../utils/ApiError'
import { env } from '../config/env'

export function errorHandler(
  err: Error | ApiError | ZodError | any,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  // Always log unexpected errors in non-test environments
  if (env.NODE_ENV !== 'test') {
    console.error(`[Error] [${err.name || 'Error'}]:`, err.message || err)
  }

  // 1. Handled ApiError
  if (err instanceof ApiError) {
    res.status(err.statusCode).json({
      success: false,
      error: {
        code: err.code,
        message: err.message,
        ...(err.details ? { details: err.details } : {}),
      },
    })
    return
  }

  // 2. Zod validation error
  if (err instanceof ZodError || err.name === 'ZodError') {
    const formattedMessage = err.issues
      ? err.issues.map((issue: any) => `${issue.path.join('.')}: ${issue.message}`).join('; ')
      : err.message

    res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: formattedMessage,
        details: err.issues,
      },
    })
    return
  }

  // 3. Mongoose Validation Error
  if (err.name === 'ValidationError') {
    const messages = err.errors
      ? Object.values(err.errors).map((e: any) => e.message).join('; ')
      : err.message

    res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: messages,
      },
    })
    return
  }

  // 4. Mongoose Duplicate Key Error (E11000)
  if (err.code === 11000) {
    const fields = err.keyValue ? Object.keys(err.keyValue).join(', ') : 'field'
    res.status(409).json({
      success: false,
      error: {
        code: 'DUPLICATE_KEY',
        message: `Duplicate value entered for ${fields}. It must be unique.`,
      },
    })
    return
  }

  // 5. Mongoose CastError (Invalid ObjectId)
  if (err.name === 'CastError') {
    res.status(400).json({
      success: false,
      error: {
        code: 'INVALID_ID',
        message: `Invalid format for field: ${err.path || 'identifier'}`,
      },
    })
    return
  }

  // 6. Generic unhandled error (500)
  const isDev = env.NODE_ENV === 'development'
  res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Internal server error',
      ...(isDev && { stack: err.stack }),
    },
  })
}
