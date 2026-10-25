/**
 * scripts/google-auth-test.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Google Authentication (ID-token flow) Test Suite
 *
 * Requirements:
 * - googleEnabled false and 503 when GOOGLE_CLIENT_ID is unset; config shows the client id when set
 * - new Google user -> 201, role USER, token works on /auth/me; the same Google user again -> 200 and the users count does not grow
 * - email_verified false -> 401; non-Gmail without hostedDomain -> 403; Workspace email with hostedDomain -> accepted
 * - verifier throws (bad signature or audience) -> 401 GOOGLE_TOKEN_INVALID
 * - same email as an existing password USER -> 409 ACCOUNT_EXISTS_USE_PASSWORD and no link happened
 * - same email as the seeded NOTARY and ADMIN -> 409 and the roles are untouched
 * - disabled Google user -> 403 ACCOUNT_DISABLED
 * - password login for a Google-only user -> the same generic 401
 * - link: a logged-in password user links Google -> 200, then Google login signs into that same account; googleId of another user -> 409 GOOGLE_ALREADY_LINKED; no token -> 401
 * - no response contains passwordHash, googleId or the credential
 * - RBAC matrix updated for the new endpoints (anonymous, USER, NOTARY, ADMIN); rate limit returns 429 when exceeded
 * ─────────────────────────────────────────────────────────────────────────────
 */

import http from 'http'
import mongoose from 'mongoose'
import bcrypt from 'bcryptjs'
import app from '../src/app'
import { env } from '../src/config/env'
import { User } from '../src/models/User'
import {
  setGoogleIdTokenVerifier,
  resetGoogleIdTokenVerifier,
  GooglePayload,
} from '../src/services/googleAuth.service'

let server: http.Server | null = null
let BASE_URL = ''
let testsPassed = 0
let testsFailed = 0

const MONGODB_URI_TEST = process.env.MONGODB_URI_TEST || 'mongodb://localhost:27017/gohash_test'

function getDatabaseName(uri: string): string {
  try {
    const parsed = new URL(uri)
    return parsed.pathname.replace(/^\//, '').split('?')[0]
  } catch {
    const match = uri.match(/\/([^/?]+)(\?|$)/)
    return match ? match[1] : ''
  }
}

const dbName = getDatabaseName(MONGODB_URI_TEST)
if (!dbName || !dbName.endsWith('_test')) {
  console.error(`Refusing to run google-auth test: database name "${dbName}" in MONGODB_URI_TEST must end with "_test".`)
  process.exit(1)
}

function logPass(name: string, detail = '') {
  testsPassed++
  console.log(`  \x1b[32m✔ PASS\x1b[0m [${name}] ${detail}`)
}

function logFail(name: string, error: unknown) {
  testsFailed++
  console.error(`  \x1b[31m✘ FAIL\x1b[0m [${name}]:`, error)
}

const FORBIDDEN_KEYS = ['passwordHash', 'googleId', 'credential', 'walletNonce', 'walletNonceExpiry']

function checkForSensitiveFields(obj: any, context: string, visited = new Set()): void {
  if (!obj || typeof obj !== 'object' || visited.has(obj)) return
  visited.add(obj)

  if (Array.isArray(obj)) {
    for (const item of obj) {
      checkForSensitiveFields(item, context, visited)
    }
    return
  }

  for (const [key, value] of Object.entries(obj)) {
    if (FORBIDDEN_KEYS.includes(key)) {
      throw new Error(`[SECURITY LEAK] Forbidden field "${key}" exposed in response for ${context}!`)
    }
    if (typeof value === 'object') {
      checkForSensitiveFields(value, context, visited)
    }
  }
}

async function request(
  path: string,
  options: {
    method?: string
    headers?: Record<string, string>
    body?: Record<string, unknown>
    token?: string | null
  } = {}
): Promise<{ status: number; data: any; headers: Headers }> {
  const method = options.method || 'GET'
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  }
  if (options.token) {
    headers['Authorization'] = `Bearer ${options.token}`
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  })

  let data: any = null
  try {
    data = await res.json()
  } catch {
    data = null
  }

  if (data) {
    checkForSensitiveFields(data, `${method} ${path}`)
  }

  return { status: res.status, data, headers: res.headers }
}

async function runGoogleAuthTests() {
  console.log('\n================================================================================')
  console.log('         GoHash — Google ID-Token Authentication Test Suite')
  console.log('================================================================================')
  console.log(`Database: ${dbName}`)

  const originalClientId = env.GOOGLE_CLIENT_ID || '911792744904-i1c3ichdrhqo63vk82ugf51d8jg7viji.apps.googleusercontent.com'
  const testPassword = 'TestPassword123!'

  try {
    // 1. Fail-fast MongoDB connection
    try {
      await mongoose.connect(MONGODB_URI_TEST, { serverSelectionTimeoutMS: 4000 })
      console.log('✅ Connected to MongoDB test database.')
      await mongoose.connection.dropDatabase()
    } catch {
      console.error(`❌ Refusing to continue: MongoDB unreachable at ${MONGODB_URI_TEST}.`)
      console.error(`   Start MongoDB with: docker start gohash-mongo`)
      process.exit(1)
    }

    // 2. Start in-process ephemeral server
    server = http.createServer(app)
    await new Promise<void>((resolve) => {
      server!.listen(0, '127.0.0.1', () => {
        const addr = server!.address() as { port: number }
        BASE_URL = `http://127.0.0.1:${addr.port}`
        console.log(`🚀 Isolated test server running on ${BASE_URL}\n`)
        resolve()
      })
    })

    // Seed test Admin and Notary accounts for collision tests
    const passwordHash = await bcrypt.hash(testPassword, 12)
    await User.create({
      name: 'Seed Admin',
      email: env.SEED_ADMIN_EMAIL.toLowerCase(),
      passwordHash,
      role: 'ADMIN',
      authProviders: ['PASSWORD'],
      isActive: true,
    })
    await User.create({
      name: 'Seed Notary',
      email: env.SEED_NOTARY_EMAIL.toLowerCase(),
      passwordHash,
      role: 'NOTARY',
      authProviders: ['PASSWORD'],
      isActive: true,
    })

    // ─── Test 1: Auth Rate Limiting on POST /api/auth/google (Fresh IP) ─────
    console.log('--- 1. Rate Limiting on POST /api/auth/google (Fresh IP) ---')
    try {
      env.AUTH_RATE_LIMIT_MAX = 2
      // Using mock verifier that fails
      setGoogleIdTokenVerifier(async () => {
        throw new Error('Invalid signature')
      })

      const a1 = await request('/api/auth/google', { method: 'POST', body: { credential: 'tok1' } })
      const a2 = await request('/api/auth/google', { method: 'POST', body: { credential: 'tok2' } })
      const a3 = await request('/api/auth/google', { method: 'POST', body: { credential: 'tok3' } })

      // Restore high limit immediately
      env.AUTH_RATE_LIMIT_MAX = 1000

      if (
        a1.status === 401 &&
        a2.status === 401 &&
        a3.status === 429 &&
        a3.data?.error?.code === 'RATE_LIMITED'
      ) {
        logPass('POST /api/auth/google Rate Limit', '429 RATE_LIMITED returned when rate limit exceeded')
      } else {
        logFail('POST /api/auth/google Rate Limit', `Expected [401, 401, 429], got [${a1.status}, ${a2.status}, ${a3.status}]`)
      }
    } catch (err) {
      env.AUTH_RATE_LIMIT_MAX = 1000
      logFail('Rate Limiting', err)
    }

    // ─── Test 2: Config & 503 when GOOGLE_CLIENT_ID is unset ─────────────────
    console.log('\n--- 2. Disabled State (GOOGLE_CLIENT_ID Unset) ---')
    try {
      env.GOOGLE_CLIENT_ID = ''

      const configRes = await request('/api/auth/config')
      if (
        configRes.status === 200 &&
        configRes.data?.success === true &&
        configRes.data?.googleEnabled === false &&
        configRes.data?.googleClientId === undefined
      ) {
        logPass('GET /api/auth/config (Disabled)', 'Returns { success: true, googleEnabled: false } without googleClientId')
      } else {
        logFail('GET /api/auth/config (Disabled)', `Unexpected response: ${JSON.stringify(configRes.data)}`)
      }

      const googleRes = await request('/api/auth/google', {
        method: 'POST',
        body: { credential: 'dummy-credential-disabled' },
      })
      if (
        googleRes.status === 503 &&
        googleRes.data?.error?.code === 'GOOGLE_AUTH_DISABLED'
      ) {
        logPass('POST /api/auth/google (Disabled)', 'Returns 503 GOOGLE_AUTH_DISABLED')
      } else {
        logFail('POST /api/auth/google (Disabled)', `Expected 503, got ${googleRes.status}: ${JSON.stringify(googleRes.data)}`)
      }
    } catch (err) {
      logFail('Disabled State', err)
    }

    // ─── Test 3: Config when GOOGLE_CLIENT_ID is set ─────────────────────────
    console.log('\n--- 3. Enabled State (GOOGLE_CLIENT_ID Set) ---')
    try {
      env.GOOGLE_CLIENT_ID = originalClientId

      const configRes = await request('/api/auth/config')
      if (
        configRes.status === 200 &&
        configRes.data?.success === true &&
        configRes.data?.googleEnabled === true &&
        configRes.data?.googleClientId === originalClientId
      ) {
        logPass('GET /api/auth/config (Enabled)', `Returns googleEnabled: true and googleClientId: ${originalClientId}`)
      } else {
        logFail('GET /api/auth/config (Enabled)', `Unexpected response: ${JSON.stringify(configRes.data)}`)
      }
    } catch (err) {
      logFail('Enabled State', err)
    }

    // ─── Test 4: Verifier Throws -> 401 GOOGLE_TOKEN_INVALID ─────────────────
    console.log('\n--- 4. Token Verification Failure ---')
    try {
      setGoogleIdTokenVerifier(async () => {
        throw new Error('Token verification signature error or bad audience')
      })

      const res = await request('/api/auth/google', {
        method: 'POST',
        body: { credential: 'invalid-token-signature' },
      })

      if (
        res.status === 401 &&
        res.data?.error?.code === 'GOOGLE_TOKEN_INVALID' &&
        res.data?.error?.message === 'Invalid Google token.'
      ) {
        logPass('POST /api/auth/google (Token Invalid)', 'Returns generic 401 GOOGLE_TOKEN_INVALID without internal error leak')
      } else {
        logFail('POST /api/auth/google (Token Invalid)', `Expected 401, got ${res.status}: ${JSON.stringify(res.data)}`)
      }
    } catch (err) {
      logFail('Token Verification Failure', err)
    }

    // ─── Test 5: email_verified False -> 401 GOOGLE_EMAIL_NOT_VERIFIED ──────
    console.log('\n--- 5. Email Not Verified ---')
    try {
      setGoogleIdTokenVerifier(async (): Promise<GooglePayload> => ({
        sub: 'google-sub-unverified-123',
        email: 'unverified@gmail.com',
        emailVerified: false,
        name: 'Unverified User',
      }))

      const res = await request('/api/auth/google', {
        method: 'POST',
        body: { credential: 'tok-unverified' },
      })

      if (
        res.status === 401 &&
        res.data?.error?.code === 'GOOGLE_EMAIL_NOT_VERIFIED'
      ) {
        logPass('POST /api/auth/google (Email Not Verified)', 'Returns 401 GOOGLE_EMAIL_NOT_VERIFIED')
      } else {
        logFail('POST /api/auth/google (Email Not Verified)', `Expected 401, got ${res.status}: ${JSON.stringify(res.data)}`)
      }
    } catch (err) {
      logFail('Email Not Verified', err)
    }

    // ─── Test 6: Non-Gmail Without hostedDomain -> 403 GOOGLE_EMAIL_NOT_SUPPORTED
    console.log('\n--- 6. Non-Gmail Without hostedDomain ---')
    try {
      setGoogleIdTokenVerifier(async (): Promise<GooglePayload> => ({
        sub: 'google-sub-yahoo-456',
        email: 'attacker@yahoo.com',
        emailVerified: true,
        name: 'Yahoo User',
      }))

      const res = await request('/api/auth/google', {
        method: 'POST',
        body: { credential: 'tok-yahoo' },
      })

      if (
        res.status === 403 &&
        res.data?.error?.code === 'GOOGLE_EMAIL_NOT_SUPPORTED' &&
        res.data?.error?.message?.includes('Use a Gmail or Google Workspace account.')
      ) {
        logPass('POST /api/auth/google (Non-Gmail Non-Workspace)', 'Returns 403 GOOGLE_EMAIL_NOT_SUPPORTED')
      } else {
        logFail('POST /api/auth/google (Non-Gmail Non-Workspace)', `Expected 403, got ${res.status}: ${JSON.stringify(res.data)}`)
      }
    } catch (err) {
      logFail('Non-Gmail Non-Workspace', err)
    }

    // ─── Test 7: Workspace Email with hostedDomain -> Accepted ───────────────
    console.log('\n--- 7. Google Workspace Email (hostedDomain Set) ---')
    try {
      setGoogleIdTokenVerifier(async (): Promise<GooglePayload> => ({
        sub: 'google-sub-workspace-789',
        email: 'executive@enterprise.org',
        emailVerified: true,
        name: 'Executive User',
        hostedDomain: 'enterprise.org',
      }))

      const res = await request('/api/auth/google', {
        method: 'POST',
        body: { credential: 'tok-workspace' },
      })

      if (
        res.status === 201 &&
        res.data?.success === true &&
        res.data?.user?.email === 'executive@enterprise.org' &&
        res.data?.user?.role === 'USER'
      ) {
        logPass('POST /api/auth/google (Workspace)', 'Accepted 201 with role USER')
      } else {
        logFail('POST /api/auth/google (Workspace)', `Expected 201, got ${res.status}: ${JSON.stringify(res.data)}`)
      }
    } catch (err) {
      logFail('Workspace Email', err)
    }

    // ─── Test 8: New Google User -> 201, role USER, token works on /auth/me ──
    console.log('\n--- 8. New Google User Creation & /auth/me ---')
    let googleUserToken = ''
    let googleUserId = ''
    const googleSubAlice = 'google-sub-alice-1001'
    const googleEmailAlice = 'alice.gohash@gmail.com'

    try {
      setGoogleIdTokenVerifier(async (): Promise<GooglePayload> => ({
        sub: googleSubAlice,
        email: googleEmailAlice,
        emailVerified: true,
        name: 'Alice Google',
      }))

      const res = await request('/api/auth/google', {
        method: 'POST',
        body: { credential: 'tok-alice' },
      })

      googleUserToken = res.data?.token
      googleUserId = res.data?.user?.id

      if (
        res.status === 201 &&
        res.data?.success === true &&
        googleUserToken &&
        res.data?.user?.email === googleEmailAlice &&
        res.data?.user?.role === 'USER' &&
        res.data?.user?.googleLinked === true &&
        Array.isArray(res.data?.user?.authProviders) &&
        res.data?.user?.authProviders.includes('GOOGLE')
      ) {
        logPass('POST /api/auth/google (New User)', `Created user 201, role USER, googleLinked: true, authProviders: [GOOGLE]`)
      } else {
        logFail('POST /api/auth/google (New User)', `Expected 201, got ${res.status}: ${JSON.stringify(res.data)}`)
      }

      // Token works on GET /api/auth/me
      const meRes = await request('/api/auth/me', { token: googleUserToken })
      if (
        meRes.status === 200 &&
        meRes.data?.success === true &&
        meRes.data?.user?.id === googleUserId &&
        meRes.data?.user?.googleLinked === true &&
        meRes.data?.user?.authProviders.includes('GOOGLE') &&
        meRes.data?.user?.googleId === undefined &&
        meRes.data?.user?.passwordHash === undefined
      ) {
        logPass('GET /api/auth/me (Google User)', 'Returns profile with googleLinked: true, authProviders, no googleId or passwordHash')
      } else {
        logFail('GET /api/auth/me (Google User)', `Unexpected response: ${JSON.stringify(meRes.data)}`)
      }
    } catch (err) {
      logFail('New Google User Creation', err)
    }

    // ─── Test 9: Same Google User Again -> 200 and Users Count Does Not Grow ─
    console.log('\n--- 9. Existing Google User Login (Idempotent) ---')
    try {
      const countBefore = await User.countDocuments()

      const res = await request('/api/auth/google', {
        method: 'POST',
        body: { credential: 'tok-alice' },
      })

      const countAfter = await User.countDocuments()

      if (
        res.status === 200 &&
        res.data?.success === true &&
        res.data?.user?.id === googleUserId &&
        countBefore === countAfter
      ) {
        logPass('POST /api/auth/google (Existing User)', `Returns 200, user counts unchanged (${countBefore} == ${countAfter})`)
      } else {
        logFail('POST /api/auth/google (Existing User)', `Expected 200 and count ${countBefore}, got ${res.status} and count ${countAfter}`)
      }
    } catch (err) {
      logFail('Existing Google User Login', err)
    }

    // ─── Test 10: Disabled Google User -> 403 ACCOUNT_DISABLED ────────────────
    console.log('\n--- 10. Disabled Google User ---')
    try {
      await User.updateOne({ _id: googleUserId }, { isActive: false })

      const res = await request('/api/auth/google', {
        method: 'POST',
        body: { credential: 'tok-alice' },
      })

      if (
        res.status === 403 &&
        res.data?.error?.code === 'ACCOUNT_DISABLED'
      ) {
        logPass('POST /api/auth/google (Disabled Account)', 'Returns 403 ACCOUNT_DISABLED')
      } else {
        logFail('POST /api/auth/google (Disabled Account)', `Expected 403, got ${res.status}: ${JSON.stringify(res.data)}`)
      }

      // Re-enable account
      await User.updateOne({ _id: googleUserId }, { isActive: true })
    } catch (err) {
      logFail('Disabled Google User', err)
    }

    // ─── Test 11: Password Login for Google-Only User -> Generic 401 ──────────
    console.log('\n--- 11. Password Login on Google-Only Account ---')
    try {
      const res = await request('/api/auth/login', {
        method: 'POST',
        body: { email: googleEmailAlice, password: 'AnyPassword123!' },
      })

      if (
        res.status === 401 &&
        res.data?.error?.code === 'INVALID_CREDENTIALS' &&
        res.data?.error?.message === 'Invalid email or password'
      ) {
        logPass('POST /api/auth/login (Google-Only User)', 'Returns generic 401 INVALID_CREDENTIALS without crashing')
      } else {
        logFail('POST /api/auth/login (Google-Only User)', `Expected 401, got ${res.status}: ${JSON.stringify(res.data)}`)
      }
    } catch (err) {
      logFail('Password Login on Google-Only Account', err)
    }

    // ─── Test 12: Same Email as Existing Password USER -> 409 ─────────────────
    console.log('\n--- 12. Email Conflict With Existing Password User ---')
    const passwordUserEmail = 'password.user@gmail.com'
    try {
      // Register password user
      const regRes = await request('/api/auth/register', {
        method: 'POST',
        body: {
          name: 'Password User',
          email: passwordUserEmail,
          password: testPassword,
          confirmPassword: testPassword,
        },
      })
      if (regRes.status !== 201) {
        throw new Error(`Failed to register password user: ${JSON.stringify(regRes.data)}`)
      }

      // Try Google sign-in with the same email but new googleId
      setGoogleIdTokenVerifier(async (): Promise<GooglePayload> => ({
        sub: 'google-sub-unlinked-new',
        email: passwordUserEmail,
        emailVerified: true,
        name: 'Google Impersonator',
      }))

      const googleRes = await request('/api/auth/google', {
        method: 'POST',
        body: { credential: 'tok-conflict' },
      })

      const pwUserInDb = await User.findOne({ email: passwordUserEmail }).select('+googleId')

      if (
        googleRes.status === 409 &&
        googleRes.data?.error?.code === 'ACCOUNT_EXISTS_USE_PASSWORD' &&
        googleRes.data?.error?.message?.includes('An account with this email already exists.') &&
        !pwUserInDb?.googleId
      ) {
        logPass('POST /api/auth/google (Email Conflict)', 'Returns 409 ACCOUNT_EXISTS_USE_PASSWORD and does not auto-link')
      } else {
        logFail('POST /api/auth/google (Email Conflict)', `Expected 409, got ${googleRes.status}: ${JSON.stringify(googleRes.data)}`)
      }
    } catch (err) {
      logFail('Email Conflict With Existing Password User', err)
    }

    // ─── Test 13: Same Email as Seeded NOTARY and ADMIN -> 409 ────────────────
    console.log('\n--- 13. Collision With Seeded NOTARY and ADMIN ---')
    try {
      // Test NOTARY collision
      setGoogleIdTokenVerifier(async (): Promise<GooglePayload> => ({
        sub: 'google-sub-notary-impersonator',
        email: env.SEED_NOTARY_EMAIL.toLowerCase(),
        emailVerified: true,
        hostedDomain: 'gohash.io',
      }))

      const notaryRes = await request('/api/auth/google', {
        method: 'POST',
        body: { credential: 'tok-notary' },
      })

      const notaryUserInDb = await User.findOne({ email: env.SEED_NOTARY_EMAIL.toLowerCase() }).select('+googleId')

      if (
        notaryRes.status === 409 &&
        notaryRes.data?.error?.code === 'ACCOUNT_EXISTS_USE_PASSWORD' &&
        notaryUserInDb?.role === 'NOTARY' &&
        !notaryUserInDb?.googleId
      ) {
        logPass('POST /api/auth/google (Notary Collision)', 'Returns 409 and NOTARY role remains untouched')
      } else {
        logFail('POST /api/auth/google (Notary Collision)', `Expected 409, got ${notaryRes.status}: ${JSON.stringify(notaryRes.data)}`)
      }

      // Test ADMIN collision
      setGoogleIdTokenVerifier(async (): Promise<GooglePayload> => ({
        sub: 'google-sub-admin-impersonator',
        email: env.SEED_ADMIN_EMAIL.toLowerCase(),
        emailVerified: true,
        hostedDomain: 'gohash.io',
      }))

      const adminRes = await request('/api/auth/google', {
        method: 'POST',
        body: { credential: 'tok-admin' },
      })

      const adminUserInDb = await User.findOne({ email: env.SEED_ADMIN_EMAIL.toLowerCase() }).select('+googleId')

      if (
        adminRes.status === 409 &&
        adminRes.data?.error?.code === 'ACCOUNT_EXISTS_USE_PASSWORD' &&
        adminUserInDb?.role === 'ADMIN' &&
        !adminUserInDb?.googleId
      ) {
        logPass('POST /api/auth/google (Admin Collision)', 'Returns 409 and ADMIN role remains untouched')
      } else {
        logFail('POST /api/auth/google (Admin Collision)', `Expected 409, got ${adminRes.status}: ${JSON.stringify(adminRes.data)}`)
      }
    } catch (err) {
      logFail('Collision With Seeded Roles', err)
    }

    // ─── Test 14: Google Account Linking Flow ─────────────────────────────────
    console.log('\n--- 14. Google Account Linking (POST /api/auth/google/link) ---')
    let linkUserToken = ''
    let linkUserId = ''
    const linkUserEmail = 'link.tester@gmail.com'
    const googleSubForLink = 'google-sub-linked-unique-555'

    try {
      // 1. Register link user
      const reg = await request('/api/auth/register', {
        method: 'POST',
        body: { name: 'Link Tester', email: linkUserEmail, password: testPassword, confirmPassword: testPassword },
      })
      linkUserToken = reg.data?.token
      linkUserId = reg.data?.user?.id

      // 2. No token -> 401 UNAUTHORIZED
      const noAuthRes = await request('/api/auth/google/link', {
        method: 'POST',
        body: { credential: 'tok-link' },
      })
      if (noAuthRes.status === 401) {
        logPass('POST /api/auth/google/link (No Auth)', 'Blocked 401 UNAUTHORIZED')
      } else {
        logFail('POST /api/auth/google/link (No Auth)', `Expected 401, got ${noAuthRes.status}`)
      }

      // 3. Link with different email than GoHash account (allowed!)
      setGoogleIdTokenVerifier(async (): Promise<GooglePayload> => ({
        sub: googleSubForLink,
        email: 'different.google.email@gmail.com',
        emailVerified: true,
        name: 'Link Tester Google',
      }))

      const linkRes = await request('/api/auth/google/link', {
        method: 'POST',
        token: linkUserToken,
        body: { credential: 'tok-link' },
      })

      if (
        linkRes.status === 200 &&
        linkRes.data?.success === true &&
        linkRes.data?.user?.id === linkUserId &&
        linkRes.data?.user?.googleLinked === true &&
        linkRes.data?.user?.authProviders.includes('PASSWORD') &&
        linkRes.data?.user?.authProviders.includes('GOOGLE')
      ) {
        logPass('POST /api/auth/google/link', 'Successfully linked Google account (different email allowed), returns 200')
      } else {
        logFail('POST /api/auth/google/link', `Expected 200, got ${linkRes.status}: ${JSON.stringify(linkRes.data)}`)
      }

      // 4. Now Google sign-in logs into the same GoHash account!
      const googleLoginRes = await request('/api/auth/google', {
        method: 'POST',
        body: { credential: 'tok-link' },
      })

      if (
        googleLoginRes.status === 200 &&
        googleLoginRes.data?.user?.id === linkUserId &&
        googleLoginRes.data?.user?.email === linkUserEmail
      ) {
        logPass('POST /api/auth/google (After Link)', 'Google sign-in authenticates into the linked password account')
      } else {
        logFail('POST /api/auth/google (After Link)', `Expected 200 for user ${linkUserId}, got: ${JSON.stringify(googleLoginRes.data)}`)
      }

      // 5. Idempotent link: same googleId again -> 200
      const idempotentRes = await request('/api/auth/google/link', {
        method: 'POST',
        token: linkUserToken,
        body: { credential: 'tok-link' },
      })
      if (idempotentRes.status === 200 && idempotentRes.data?.success === true) {
        logPass('POST /api/auth/google/link (Idempotent)', 'Calling link with same googleId returns 200')
      } else {
        logFail('POST /api/auth/google/link (Idempotent)', `Expected 200, got ${idempotentRes.status}`)
      }

      // 6. User already has a different googleId -> 409 ALREADY_LINKED
      setGoogleIdTokenVerifier(async (): Promise<GooglePayload> => ({
        sub: 'google-sub-different-account-999',
        email: 'another.google@gmail.com',
        emailVerified: true,
      }))

      const alreadyLinkedRes = await request('/api/auth/google/link', {
        method: 'POST',
        token: linkUserToken,
        body: { credential: 'tok-diff' },
      })

      if (
        alreadyLinkedRes.status === 409 &&
        alreadyLinkedRes.data?.error?.code === 'ALREADY_LINKED'
      ) {
        logPass('POST /api/auth/google/link (Already Linked)', 'Returns 409 ALREADY_LINKED when attempting to link second Google account')
      } else {
        logFail('POST /api/auth/google/link (Already Linked)', `Expected 409 ALREADY_LINKED, got: ${JSON.stringify(alreadyLinkedRes.data)}`)
      }

      // 7. Another user tries to link the already used googleId -> 409 GOOGLE_ALREADY_LINKED
      const user2Reg = await request('/api/auth/register', {
        method: 'POST',
        body: { name: 'User 2', email: 'user2@gmail.com', password: testPassword, confirmPassword: testPassword },
      })
      const user2Token = user2Reg.data?.token

      setGoogleIdTokenVerifier(async (): Promise<GooglePayload> => ({
        sub: googleSubForLink, // already used by link.tester
        email: 'different.google.email@gmail.com',
        emailVerified: true,
      }))

      const conflictLinkRes = await request('/api/auth/google/link', {
        method: 'POST',
        token: user2Token,
        body: { credential: 'tok-link' },
      })

      if (
        conflictLinkRes.status === 409 &&
        conflictLinkRes.data?.error?.code === 'GOOGLE_ALREADY_LINKED'
      ) {
        logPass('POST /api/auth/google/link (Google Already Linked)', 'Returns 409 GOOGLE_ALREADY_LINKED for another user')
      } else {
        logFail('POST /api/auth/google/link (Google Already Linked)', `Expected 409 GOOGLE_ALREADY_LINKED, got: ${JSON.stringify(conflictLinkRes.data)}`)
      }
    } catch (err) {
      logFail('Google Account Linking', err)
    }

    // ─── Test 15: Admin Users List & Sensitive Field Scan ─────────────────────
    console.log('\n--- 15. Admin Users List & Sensitive Fields ---')
    try {
      const adminLogin = await request('/api/auth/login', {
        method: 'POST',
        body: { email: env.SEED_ADMIN_EMAIL.toLowerCase(), password: testPassword },
      })
      const adminToken = adminLogin.data?.token

      const usersListRes = await request('/api/admin/users', { token: adminToken })
      if (usersListRes.status === 200 && Array.isArray(usersListRes.data?.users)) {
        const users = usersListRes.data.users
        let allHaveFields = true
        for (const u of users) {
          if (!Array.isArray(u.authProviders) || typeof u.googleLinked !== 'boolean') {
            allHaveFields = false
            break
          }
        }
        if (allHaveFields) {
          logPass('GET /api/admin/users', `All ${users.length} users include authProviders and googleLinked`)
        } else {
          logFail('GET /api/admin/users', 'Some users lack authProviders or googleLinked boolean')
        }
      } else {
        logFail('GET /api/admin/users', `Expected 200, got: ${usersListRes.status}`)
      }
    } catch (err) {
      logFail('Admin Users List', err)
    }

  } finally {
    resetGoogleIdTokenVerifier()
    env.GOOGLE_CLIENT_ID = originalClientId

    if (server) {
      await new Promise<void>((resolve) => {
        server?.close(() => resolve())
      })
      console.log('🛑 Isolated test server stopped.')
    }

    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.dropDatabase()
      await mongoose.disconnect()
      console.log('🔌 Test database dropped and disconnected.')
    }
  }

  console.log('\n========================================')
  console.log(`Results: ${testsPassed} PASSED, ${testsFailed} FAILED`)
  console.log('========================================\n')

  if (testsFailed > 0) {
    process.exit(1)
  }
}

runGoogleAuthTests().catch((err) => {
  console.error('Fatal error during google auth test execution:', err)
  process.exit(1)
})
