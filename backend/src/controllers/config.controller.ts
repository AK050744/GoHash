import { Request, Response } from 'express'
import { asyncHandler } from '../utils/asyncHandler'
import { getFeeConfig } from '../config/fee'

/**
 * GET /api/config/fees (public)
 * Returns public fee configuration.
 * When enabled: { success: true, enabled: true, amountEth, amountWei, recipient, chainId, symbol: "ETH" }
 * When disabled: { success: true, enabled: false }
 */
export const getFeeConfigHandler = asyncHandler(async (_req: Request, res: Response) => {
  const config = getFeeConfig()
  if (!config.enabled) {
    res.status(200).json({
      success: true,
      enabled: false,
    })
    return
  }

  res.status(200).json({
    success: true,
    enabled: true,
    amountEth: config.amountEth,
    amountWei: config.amountWei,
    recipient: config.recipient,
    chainId: config.chainId,
    symbol: config.symbol,
  })
})
