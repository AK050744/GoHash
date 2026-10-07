export class ApiError extends Error {
  public readonly statusCode: number
  public readonly code: string
  public readonly details?: unknown

  constructor(statusCode: number, code: string, message: string, details?: unknown) {
    super(message)
    this.name = 'ApiError'
    this.statusCode = statusCode
    this.code = code
    this.details = details

    // Maintain proper stack trace in V8
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ApiError)
    }
  }

  static badRequest(message = 'Bad request', code = 'BAD_REQUEST', details?: unknown): ApiError {
    return new ApiError(400, code, message, details)
  }

  static unauthorized(message = 'Unauthorized access', code = 'UNAUTHORIZED', details?: unknown): ApiError {
    return new ApiError(401, code, message, details)
  }

  static forbidden(message = 'Access forbidden', code = 'FORBIDDEN', details?: unknown): ApiError {
    return new ApiError(403, code, message, details)
  }

  static notFound(message = 'Resource not found', code = 'NOT_FOUND', details?: unknown): ApiError {
    return new ApiError(404, code, message, details)
  }

  static conflict(message = 'Resource conflict', code = 'CONFLICT', details?: unknown): ApiError {
    return new ApiError(409, code, message, details)
  }

  static internal(message = 'Internal server error', code = 'INTERNAL_SERVER_ERROR', details?: unknown): ApiError {
    return new ApiError(500, code, message, details)
  }

  static notImplemented(message = 'Endpoint not implemented', code = 'NOT_IMPLEMENTED', details?: unknown): ApiError {
    return new ApiError(501, code, message, details)
  }
}
