import { Request, Response, NextFunction } from 'express'
import { ZodError } from 'zod'
import { ApiError } from '../utils/ApiError'
import { env } from '../config/env'

function redactSensitiveLog(val: any): any {
  if (val === null || val === undefined) return val
  if (typeof val === 'string') {
    return val.replace(/(["']?credential["']?\s*[:=]\s*["'])([^"']+)(["'])/gi, '$1[REDACTED]$3')
  }
  if (typeof val === 'object') {
    if (val instanceof Error) {
      val.message = redactSensitiveLog(val.message)
      if (val.stack) val.stack = redactSensitiveLog(val.stack)
      return val
    }
  }
  return val
}

export function errorHandler(
  err: Error | ApiError | ZodError | any,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  // Always log unexpected errors in non-test environments (redacting any credential fields)
  if (env.NODE_ENV !== 'test') {
    const safeMsg = redactSensitiveLog(err.message || err)
    console.error(`[Error] [${err.name || 'Error'}]:`, safeMsg)
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

  // 1b. Multer file upload errors
  if (err.name === 'MulterError' || err.code === 'LIMIT_FILE_SIZE') {
    if (err.code === 'LIMIT_FILE_SIZE') {
      res.status(400).json({
        success: false,
        error: {
          code: 'FILE_TOO_LARGE',
          message: `File size exceeds the limit of ${env.MAX_FILE_SIZE_MB}MB`,
        },
      })
      return
    }
    res.status(400).json({
      success: false,
      error: {
        code: 'INVALID_FILE',
        message: err.message || 'File upload error',
      },
    })
    return
  }

  // 2. Zod validation error
  if (err instanceof ZodError || err.name === 'ZodError') {
    let customCode = err.issues?.find((issue: any) => issue.params?.code)?.params?.code
    if (!customCode && err.issues?.some((issue: any) => issue.path?.includes('reason'))) {
      customCode = 'REASON_REQUIRED'
    }
    const formattedMessage = err.issues
      ? err.issues.map((issue: any) => `${issue.path.join('.')}: ${issue.message}`).join('; ')
      : err.message

    const sanitizedIssues = err.issues?.map((issue: any) => {
      if (issue.path?.includes('credential')) {
        const { received, input, ...rest } = issue
        return rest
      }
      return issue
    })

    res.status(400).json({
      success: false,
      error: {
        code: customCode || 'VALIDATION_ERROR',
        message: formattedMessage,
        details: sanitizedIssues,
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
  console.error(redactSensitiveLog(err.stack || err))
  res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Internal server error',
    },
  })
}
