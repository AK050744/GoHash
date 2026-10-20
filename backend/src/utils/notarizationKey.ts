/**
 * utils/notarizationKey.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Cryptographic derivation, formatting, and normalization for unique GoHash
 * notarization keys.
 *
 * SPECIFICATION:
 *   - Derived on confirm from on-chain data:
 *     keccak256(abi.encodePacked(documentHash bytes32, transactionHash bytes32))
 *   - Stored in MongoDB as the raw 16 uppercase hex characters.
 *   - Display format: GH-XXXX-XXXX-XXXX-XXXX
 *   - The key is a lookup code derived from on-chain data, not stored in the contract.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { ethers } from 'ethers'

/**
 * Computes the raw 16-character uppercase hex notarization key.
 * The key is a lookup code derived from on-chain data, not stored in the contract.
 */
export function computeNotarizationKey(documentHash: string, transactionHash: string): string {
  const docHashBytes32 = documentHash.startsWith('0x') ? documentHash : `0x${documentHash}`
  const txHashBytes32 = transactionHash.startsWith('0x') ? transactionHash : `0x${transactionHash}`

  const digest = ethers.solidityPackedKeccak256(
    ['bytes32', 'bytes32'],
    [docHashBytes32, txHashBytes32]
  )

  // First 16 hex characters after '0x' in uppercase
  return digest.slice(2, 18).toUpperCase()
}

/**
 * Formats a 16-hex character raw key into display format: GH-XXXX-XXXX-XXXX-XXXX.
 */
export function formatNotarizationKey(rawKey: string | null | undefined): string {
  if (!rawKey) return ''
  const clean = rawKey.replace(/[^A-Fa-f0-9]/g, '').toUpperCase()
  if (clean.length !== 16) {
    return rawKey
  }
  const parts = [
    clean.slice(0, 4),
    clean.slice(4, 8),
    clean.slice(8, 12),
    clean.slice(12, 16),
  ]
  return `GH-${parts.join('-')}`
}

/**
 * Normalizes input: strips dashes and spaces, converts to uppercase,
 * removes optional 'GH' prefix if present, and verifies that the result
 * is exactly 16 hexadecimal characters.
 *
 * Returns the raw 16 hex characters if valid, or null if malformed.
 */
export function normalizeNotarizationKey(input: string | null | undefined): string | null {
  if (!input || typeof input !== 'string') return null

  // Strip dashes and spaces, uppercase
  let normalized = input.replace(/[-\s]/g, '').toUpperCase()

  // Remove optional GH prefix
  if (normalized.startsWith('GH')) {
    normalized = normalized.slice(2)
  }

  // Must be exactly 16 hexadecimal characters
  if (!/^[0-9A-F]{16}$/.test(normalized)) {
    return null
  }

  return normalized
}
