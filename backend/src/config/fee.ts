import { ethers } from 'ethers'

export interface FeeConfig {
  enabled: boolean
  amountEth?: string
  amountWei?: string
  recipient?: string
  chainId?: number
  symbol?: string
}

/**
 * Returns the current fee configuration.
 *
 * Evaluated on every call (not cached at import time) so that tests
 * and runtime environment changes take effect immediately.
 *
 * If NOTARIZATION_FEE_ETH is greater than 0, FEE_RECIPIENT_ADDRESS is mandatory
 * and must be a valid Ethereum address; otherwise this throws a configuration error.
 */
export function getFeeConfig(): FeeConfig {
  const feeEthStr = (process.env.NOTARIZATION_FEE_ETH ?? '0').trim()
  let feeEth = 0
  try {
    feeEth = parseFloat(feeEthStr)
  } catch {
    feeEth = 0
  }

  if (isNaN(feeEth) || feeEth < 0) {
    throw new Error(
      `Backend failed to start: NOTARIZATION_FEE_ETH is invalid ("${feeEthStr}"). Must be a non-negative number.`
    )
  }

  if (feeEth === 0) {
    return { enabled: false }
  }

  const recipient = (process.env.FEE_RECIPIENT_ADDRESS ?? '').trim()
  if (!recipient || !ethers.isAddress(recipient)) {
    throw new Error(
      `Backend failed to start: FEE_RECIPIENT_ADDRESS is invalid or missing ("${recipient}"). Required when NOTARIZATION_FEE_ETH is enabled.`
    )
  }

  let amountWei: string
  try {
    amountWei = ethers.parseEther(feeEthStr).toString()
  } catch {
    throw new Error(
      `Backend failed to start: NOTARIZATION_FEE_ETH is invalid ("${feeEthStr}"). Must be a valid ETH amount.`
    )
  }

  const chainId = Number(process.env.CHAIN_ID || 31337)

  return {
    enabled: true,
    amountEth: feeEthStr,
    amountWei,
    recipient: recipient.toLowerCase(),
    chainId,
    symbol: 'ETH',
  }
}
