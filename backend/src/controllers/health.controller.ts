import { Request, Response } from 'express'
import { getDbState } from '../config/db'
import { sendSuccess } from '../utils/response'

/**
 * GET /api/health
 * Returns service status, system uptime, and database connection state.
 */
export function getHealth(_req: Request, res: Response): void {
  const dbState = getDbState()

  sendSuccess(res, {
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    db: dbState,
  })
}
