import { Response } from 'express'

export interface ApiSuccessEnvelope {
  success: true
  [key: string]: unknown
}

export interface ApiErrorEnvelope {
  success: false
  error: {
    code: string
    message: string
    details?: unknown
  }
}

/**
 * Standard Success Response Envelope:
 * { "success": true, ...data }
 */
export function sendSuccess(
  res: Response,
  data: object = {},
  statusCode = 200
): Response {
  return res.status(statusCode).json({
    success: true,
    ...data,
  })
}

/**
 * Standard Error Response Envelope:
 * { "success": false, "error": { "code": "...", "message": "..." } }
 */
export function sendError(
  res: Response,
  statusCode: number,
  code: string,
  message: string,
  details?: unknown
): Response {
  return res.status(statusCode).json({
    success: false,
    error: {
      code,
      message,
      ...(details ? { details } : {}),
    },
  })
}
