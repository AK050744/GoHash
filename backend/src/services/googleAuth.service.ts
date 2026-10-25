/**
 * services/googleAuth.service.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Google ID-token verification service using google-auth-library.
 *
 * SECURITY INVARIANTS:
 * - Never log, store, or return the Google credential or any Google token.
 * - Never add or read a Google client secret.
 * - Allows replacing the verifier ONLY through an exported setter used by tests.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { OAuth2Client } from 'google-auth-library'
import { env } from '../config/env'

export interface GooglePayload {
  sub: string
  email: string
  emailVerified: boolean
  name?: string
  hostedDomain?: string
}

export type GoogleIdTokenVerifier = (credential: string) => Promise<GooglePayload>

const defaultVerifier: GoogleIdTokenVerifier = async (credential: string): Promise<GooglePayload> => {
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_ID.trim()) {
    throw new Error('GOOGLE_AUTH_DISABLED')
  }

  const client = new OAuth2Client(env.GOOGLE_CLIENT_ID)
  const ticket = await client.verifyIdToken({
    idToken: credential,
    audience: env.GOOGLE_CLIENT_ID,
  })

  const payload = ticket.getPayload()
  if (!payload || !payload.sub || !payload.email) {
    throw new Error('Invalid Google token payload')
  }

  return {
    sub: payload.sub,
    email: payload.email,
    emailVerified: Boolean(payload.email_verified),
    name: payload.name,
    hostedDomain: payload.hd,
  }
}

let activeVerifier: GoogleIdTokenVerifier = defaultVerifier

/**
 * Allow replacing the verifier ONLY through an exported setter used by tests
 * (not reachable over HTTP; the default is the real verifier).
 */
export function setGoogleIdTokenVerifier(verifier: GoogleIdTokenVerifier): void {
  activeVerifier = verifier
}

export function resetGoogleIdTokenVerifier(): void {
  activeVerifier = defaultVerifier
}

export async function verifyGoogleIdToken(credential: string): Promise<GooglePayload> {
  return activeVerifier(credential)
}
