import { Request, Response } from 'express'
import { sendError } from '../utils/response'

export function notFoundHandler(req: Request, res: Response): void {
  sendError(res, 404, 'NOT_FOUND', `Route ${req.method} ${req.originalUrl || req.path} not found`)
}
