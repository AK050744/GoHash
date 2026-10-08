import crypto from 'crypto'

/**
 * Computes the SHA-256 hexadecimal hash over a given file buffer.
 */
export function computeSha256(buffer: Buffer): string {
  return crypto.createHash('sha256').update(buffer).digest('hex')
}
