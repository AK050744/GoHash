import http from 'http'
import crypto from 'crypto'
import fs from 'fs'
import path from 'path'
import mongoose from 'mongoose'
import { ethers } from 'ethers'
import app from '../src/app'
import { env } from '../src/config/env'
import { User } from '../src/models/User'
import { DocumentModel } from '../src/models/Document'
import { Notarization } from '../src/models/Notarization'
import { requireAuth, requireRole } from '../src/middleware/auth.middleware'

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
  console.error(`Refusing to run smoke test: database name "${dbName}" in MONGODB_URI_TEST must end with "_test".`)
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

async function request(
  path: string,
  options: {
    method?: string
    headers?: Record<string, string>
    body?: Record<string, unknown>
  } = {}
): Promise<{ status: number; data: any }> {
  const method = options.method || 'GET'
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
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

  return { status: res.status, data }
}

async function uploadFileRequest(
  path: string,
  buffer: Buffer,
  filename: string,
  mimetype: string,
  token?: string
): Promise<{ status: number; data: any; headers: Headers }> {
  const formData = new FormData()
  formData.append('file', new Blob([buffer], { type: mimetype }), filename)
  const headers: Record<string, string> = {}
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers,
    body: formData,
  })

  let data: any = null
  try {
    data = await res.json()
  } catch {
    data = null
  }

  return { status: res.status, data, headers: res.headers }
}

async function runSmokeTests() {
  mongoose.connection.removeAllListeners('disconnected')
  mongoose.connection.removeAllListeners('error')

  // Check MongoDB connectivity and fail immediately if not reachable
  try {
    await mongoose.connect(MONGODB_URI_TEST, { serverSelectionTimeoutMS: 2000 })
  } catch (_err) {
    console.error(`MongoDB not reachable at ${MONGODB_URI_TEST}. Start it with: docker start gohash-mongo`)
    process.exit(1)
  }

  console.log('\n========================================')
  console.log('       GoHash Backend Smoke Test        ')
  console.log('========================================\n')
  console.log(`Database: ${dbName}\n`)

  // Drop test database at the START of the run to prevent interference from earlier runs
  await mongoose.connection.dropDatabase()

  // Ensure unique indexes (e.g. compound index on ownerId+sha256Hash, email) are built immediately
  await Promise.all([
    User.init(),
    DocumentModel.init(),
    Notarization.init(),
  ])

  // Register throwaway requireRole('ADMIN') route on express app for RBAC verification
  app.get('/api/test-rbac-admin', requireAuth, requireRole('ADMIN'), (_req, res) => {
    res.status(200).json({ success: true, message: 'Admin access confirmed' })
  })
  const rbacLayer = (app as any)._router.stack.pop()
  const notFoundIdx = (app as any)._router.stack.findIndex(
    (l: any) => l.name === 'notFoundHandler' || l.handle?.name === 'notFoundHandler'
  )
  if (notFoundIdx !== -1) {
    ;(app as any)._router.stack.splice(notFoundIdx, 0, rbacLayer)
  } else {
    ;(app as any)._router.stack.push(rbacLayer)
  }

  // Spin up isolated test server on random free port (listen(0))
  server = app.listen(0)
  await new Promise<void>((resolve, reject) => {
    server!.on('listening', () => resolve())
    server!.on('error', (err) => reject(err))
  })

  const address = server.address()
  if (!address || typeof address === 'string') {
    throw new Error('Failed to obtain ephemeral server port')
  }
  BASE_URL = `http://127.0.0.1:${address.port}`
  console.log(`🚀 Isolated test server running on ${BASE_URL}\n`)

  const testEmail = `smoke_test_${Date.now()}@example.com`
  const testPassword = 'Password123!'
  let authToken = ''
  let createdUserId = ''
  let userBId = ''
  let uploadedDocId = ''

  try {
    // 1. Health check
    try {
      const res = await request('/api/health')
      if (res.status === 200 && res.data?.success === true && res.data?.status === 'ok') {
        logPass('GET /api/health', `status=${res.status}, uptime=${res.data.uptime.toFixed(1)}s`)
      } else {
        throw new Error(`Expected 200 and success:true, received ${res.status}: ${JSON.stringify(res.data)}`)
      }
    } catch (err) {
      logFail('GET /api/health', err)
    }

    // 2. 404 handler
    try {
      const res = await request('/api/non-existent-route')
      if (res.status === 404 && res.data?.success === false && res.data?.error?.code === 'NOT_FOUND') {
        logPass('404 Envelope', `code=${res.data.error.code}`)
      } else {
        throw new Error(`Expected 404 and NOT_FOUND error envelope, got ${res.status}: ${JSON.stringify(res.data)}`)
      }
    } catch (err) {
      logFail('404 Envelope', err)
    }

    // 3. 501 Not Implemented stub (using planned /api/verify)
    try {
      const res = await request('/api/verify', { method: 'POST', body: {} })
      if (res.status === 501 && res.data?.success === false && res.data?.error?.code === 'NOT_IMPLEMENTED') {
        logPass('501 Stub Route', `code=${res.data.error.code}`)
      } else {
        throw new Error(`Expected 501 NOT_IMPLEMENTED, got ${res.status}: ${JSON.stringify(res.data)}`)
      }
    } catch (err) {
      logFail('501 Stub Route', err)
    }

    // 4. Register OK
    try {
      const res = await request('/api/auth/register', {
        method: 'POST',
        body: {
          name: 'Smoke Tester',
          email: testEmail,
          password: testPassword,
          confirmPassword: testPassword,
        },
      })

      if (res.status === 201 && res.data?.success === true && res.data?.token && res.data?.user?.role === 'USER') {
        authToken = res.data.token
        createdUserId = res.data.user.id
        logPass('POST /api/auth/register', `User ID: ${createdUserId}, role: ${res.data.user.role}`)
      } else {
        throw new Error(`Registration failed: ${res.status} - ${JSON.stringify(res.data)}`)
      }
    } catch (err) {
      logFail('POST /api/auth/register', err)
    }

    // 5. Register: duplicate email
    try {
      const res = await request('/api/auth/register', {
        method: 'POST',
        body: {
          name: 'Duplicate Tester',
          email: testEmail,
          password: testPassword,
          confirmPassword: testPassword,
        },
      })

      if (res.status === 409 && res.data?.success === false && res.data?.error?.code === 'EMAIL_ALREADY_EXISTS') {
        logPass('Duplicate Email Rejection', `status=409, code=${res.data.error.code}`)
      } else {
        throw new Error(`Expected 409 EMAIL_ALREADY_EXISTS, got ${res.status}: ${JSON.stringify(res.data)}`)
      }
    } catch (err) {
      logFail('Duplicate Email Rejection', err)
    }

    // 6. Register: role escalation ignored
    try {
      const escalationEmail = `escalate_${Date.now()}@example.com`
      const res = await request('/api/auth/register', {
        method: 'POST',
        body: {
          name: 'Hacker',
          email: escalationEmail,
          password: testPassword,
          confirmPassword: testPassword,
          role: 'ADMIN',
        },
      })

      if (res.status === 201 && res.data?.user?.role === 'USER') {
        logPass('Role In Body Ignored', 'Assigned role is strictly "USER"')
        await User.deleteOne({ email: escalationEmail })
      } else {
        throw new Error(`Expected role USER, received: ${res.data?.user?.role}`)
      }
    } catch (err) {
      logFail('Role In Body Ignored', err)
    }

    // 7. Login OK
    try {
      const res = await request('/api/auth/login', {
        method: 'POST',
        body: {
          email: testEmail,
          password: testPassword,
        },
      })

      if (res.status === 200 && res.data?.success === true && res.data?.token) {
        logPass('POST /api/auth/login', 'Received valid JWT token')
      } else {
        throw new Error(`Login failed: ${res.status} - ${JSON.stringify(res.data)}`)
      }
    } catch (err) {
      logFail('POST /api/auth/login', err)
    }

    // 8. Login: bad credentials
    try {
      const res = await request('/api/auth/login', {
        method: 'POST',
        body: {
          email: testEmail,
          password: 'WrongPassword!',
        },
      })

      if (res.status === 401 && res.data?.success === false && res.data?.error?.code === 'INVALID_CREDENTIALS') {
        logPass('Wrong Password Rejection', 'Generic 401 error returned')
      } else {
        throw new Error(`Expected 401 INVALID_CREDENTIALS, got ${res.status}: ${JSON.stringify(res.data)}`)
      }
    } catch (err) {
      logFail('Wrong Password Rejection', err)
    }

    // 9. /auth/me without token -> 401
    try {
      const res = await request('/api/auth/me')
      if (res.status === 401 && res.data?.success === false && res.data?.error?.code === 'UNAUTHORIZED') {
        logPass('GET /api/auth/me (No Token)', 'Blocked 401 UNAUTHORIZED')
      } else {
        throw new Error(`Expected 401 UNAUTHORIZED, got ${res.status}: ${JSON.stringify(res.data)}`)
      }
    } catch (err) {
      logFail('GET /api/auth/me (No Token)', err)
    }

    // 10. /auth/me with valid token -> 200
    try {
      const res = await request('/api/auth/me', {
        headers: { Authorization: `Bearer ${authToken}` },
      })

      if (res.status === 200 && res.data?.success === true && res.data?.user?.email === testEmail) {
        logPass('GET /api/auth/me (With Token)', `Fetched user ${res.data.user.email}`)
      } else {
        throw new Error(`Expected 200 with user payload, got ${res.status}: ${JSON.stringify(res.data)}`)
      }
    } catch (err) {
      logFail('GET /api/auth/me (With Token)', err)
    }

    // 11. PATCH /api/auth/wallet — signed nonce flow
    // A throwaway wallet is created in-memory (createRandom) and used ONLY to sign.
    // It is never stored, never printed to the console.
    const throwawayWallet = ethers.Wallet.createRandom()
    const throwawayAddress = throwawayWallet.address

    try {
      // 11a. Positive: correct wallet link
      // Step 1: obtain nonce message
      const nonceRes = await request('/api/auth/wallet/nonce', {
        method: 'POST',
        headers: { Authorization: `Bearer ${authToken}` },
      })
      if (!nonceRes.data?.message || !nonceRes.data?.expiresAt) {
        throw new Error(`Nonce response missing fields: ${JSON.stringify(nonceRes.data)}`)
      }
      // Step 2: sign with throwaway wallet
      const sig = await throwawayWallet.signMessage(nonceRes.data.message)
      // Step 3: PATCH wallet
      const res = await request('/api/auth/wallet', {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${authToken}` },
        body: { walletAddress: throwawayAddress, signature: sig },
      })
      if (
        res.status === 200 &&
        res.data?.success === true &&
        res.data?.user?.walletAddress === throwawayAddress.toLowerCase()
      ) {
        logPass('PATCH /api/auth/wallet (Signed Nonce)', `Wallet stored: ${res.data.user.walletAddress}`)
      } else {
        throw new Error(`Expected 200 with wallet, got ${res.status}: ${JSON.stringify(res.data)}`)
      }
    } catch (err) {
      logFail('PATCH /api/auth/wallet (Signed Nonce)', err)
    }

    // 11b. Wrong signer: sign message with a different throwaway wallet → 400 SIGNATURE_INVALID
    try {
      const wrongWallet  = ethers.Wallet.createRandom()
      const nonceRes2 = await request('/api/auth/wallet/nonce', {
        method: 'POST',
        headers: { Authorization: `Bearer ${authToken}` },
      })
      const badSig = await wrongWallet.signMessage(nonceRes2.data.message)
      const res = await request('/api/auth/wallet', {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${authToken}` },
        body: { walletAddress: throwawayAddress, signature: badSig },
      })
      if (res.status === 400 && res.data?.error?.code === 'SIGNATURE_INVALID') {
        logPass('PATCH /api/auth/wallet (Wrong Signer)', `status=400, code=${res.data.error.code}`)
      } else {
        throw new Error(`Expected 400 SIGNATURE_INVALID, got ${res.status}: ${JSON.stringify(res.data)}`)
      }
    } catch (err) {
      logFail('PATCH /api/auth/wallet (Wrong Signer)', err)
    }

    // 11c. Replay: second call with same nonce (already consumed) → 400 NONCE_INVALID
    try {
      const replayWallet = ethers.Wallet.createRandom()
      const nonceRes3 = await request('/api/auth/wallet/nonce', {
        method: 'POST',
        headers: { Authorization: `Bearer ${authToken}` },
      })
      const replaySig = await replayWallet.signMessage(nonceRes3.data.message)
      // First attempt (valid signer, but wrong address — nonce gets consumed)
      await request('/api/auth/wallet', {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${authToken}` },
        body: { walletAddress: replayWallet.address, signature: replaySig },
      })
      // Second attempt with same nonce → must fail as nonce is cleared
      const res = await request('/api/auth/wallet', {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${authToken}` },
        body: { walletAddress: replayWallet.address, signature: replaySig },
      })
      if (res.status === 400 && res.data?.error?.code === 'NONCE_INVALID') {
        logPass('PATCH /api/auth/wallet (Replay Nonce)', `status=400, code=${res.data.error.code}`)
      } else {
        throw new Error(`Expected 400 NONCE_INVALID on replay, got ${res.status}: ${JSON.stringify(res.data)}`)
      }
    } catch (err) {
      logFail('PATCH /api/auth/wallet (Replay Nonce)', err)
    }

    // 11d. Wallet in use: another user tries to link an address already linked to User A → 409 WALLET_IN_USE
    try {
      // First: User A links a fresh wallet so we have a known-in-use address.
      const freshWallet  = ethers.Wallet.createRandom()
      const freshAddress = freshWallet.address
      const freshNonce = await request('/api/auth/wallet/nonce', {
        method: 'POST',
        headers: { Authorization: `Bearer ${authToken}` },
      })
      const freshSig = await freshWallet.signMessage(freshNonce.data.message)
      await request('/api/auth/wallet', {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${authToken}` },
        body: { walletAddress: freshAddress, signature: freshSig },
      })

      // Now register User C and have them try to link the same freshAddress.
      const userCEmail = `user_c_${Date.now()}@example.com`
      const userCReg = await request('/api/auth/register', {
        method: 'POST',
        body: {
          name: 'User C',
          email: userCEmail,
          password: testPassword,
          confirmPassword: testPassword,
        },
      })
      const userCToken = userCReg.data?.token
      const userCId    = userCReg.data?.user?.id

      // User C tries to link freshAddress (already linked to User A)
      const userCNonce = await request('/api/auth/wallet/nonce', {
        method: 'POST',
        headers: { Authorization: `Bearer ${userCToken}` },
      })
      const userCSig = await freshWallet.signMessage(userCNonce.data.message)
      const res = await request('/api/auth/wallet', {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${userCToken}` },
        body: { walletAddress: freshAddress, signature: userCSig },
      })

      // Clean up User C regardless
      if (userCId) await User.deleteOne({ _id: userCId })

      if (res.status === 409 && res.data?.error?.code === 'WALLET_IN_USE') {
        logPass('PATCH /api/auth/wallet (Wallet In Use)', `status=409, code=${res.data.error.code}`)
      } else {
        throw new Error(`Expected 409 WALLET_IN_USE, got ${res.status}: ${JSON.stringify(res.data)}`)
      }
    } catch (err) {
      logFail('PATCH /api/auth/wallet (Wallet In Use)', err)
    }


    // 12. RBAC check: Regular USER blocked from requireRole('ADMIN')
    try {
      const res = await request('/api/test-rbac-admin', {
        headers: { Authorization: `Bearer ${authToken}` },
      })

      if (res.status === 403 && res.data?.success === false && res.data?.error?.code === 'FORBIDDEN') {
        logPass("RBAC requireRole('ADMIN')", 'Blocked regular USER with 403 FORBIDDEN')
      } else {
        throw new Error(`Expected 403 FORBIDDEN, got ${res.status}: ${JSON.stringify(res.data)}`)
      }
    } catch (err) {
      logFail("RBAC requireRole('ADMIN')", err)
    }

    // ─── Task 3A: Document Upload, Hashing & Notarization Endpoints ───
    console.log('\n--- Task 3A: Document Upload, Hashing & Notarization Tests ---')
    const validPdfBytes = Buffer.from('%PDF-1.4\n%GoHash Smoke Test Document\n1 0 obj\n<< /Title (Test Doc) >>\nendobj\ntrailer\n<<>>\n%%EOF\n')
    const expectedSha256 = crypto.createHash('sha256').update(validPdfBytes).digest('hex')

    // 13. Valid PDF Upload
    try {
      const res = await uploadFileRequest('/api/documents/upload', validPdfBytes, 'sample.pdf', 'application/pdf', authToken)
      if (res.status === 201 && res.data?.success === true && res.data?.document?.id) {
        uploadedDocId = res.data.document.id
        logPass('Valid PDF Upload (POST /api/documents/upload)', `Doc ID: ${uploadedDocId}, status: ${res.data.document.status}`)
      } else {
        throw new Error(`Expected 201 Created, got ${res.status}: ${JSON.stringify(res.data)}`)
      }
    } catch (err) {
      logFail('Valid PDF Upload (POST /api/documents/upload)', err)
    }

    // 14. Independent SHA-256 Hash Match
    try {
      const res = await request(`/api/documents/${uploadedDocId}`, {
        headers: { Authorization: `Bearer ${authToken}` },
      })
      if (res.status === 200 && res.data?.document?.sha256Hash === expectedSha256) {
        logPass('Independent SHA-256 Match', `Expected & API Hash: ${expectedSha256}`)
      } else {
        throw new Error(`Hash mismatch! Expected ${expectedSha256}, got ${res.data?.document?.sha256Hash}`)
      }
    } catch (err) {
      logFail('Independent SHA-256 Match', err)
    }

    // 15. Text file renamed .pdf rejected
    try {
      const fakePdfBytes = Buffer.from('This is merely plain text without PDF magic bytes')
      const res = await uploadFileRequest('/api/documents/upload', fakePdfBytes, 'fake.pdf', 'application/pdf', authToken)
      if (res.status === 400 && res.data?.success === false && res.data?.error?.code === 'INVALID_FILE') {
        logPass('Text File Renamed .pdf Rejection', `status=400, code=${res.data.error.code}`)
      } else {
        throw new Error(`Expected 400 INVALID_FILE, got ${res.status}: ${JSON.stringify(res.data)}`)
      }
    } catch (err) {
      logFail('Text File Renamed .pdf Rejection', err)
    }

    // 16. Oversized file rejected
    try {
      const oversizedBytes = Buffer.alloc((env.MAX_FILE_SIZE_MB + 1) * 1024 * 1024)
      oversizedBytes.write('%PDF-1.4')
      const res = await uploadFileRequest('/api/documents/upload', oversizedBytes, 'large.pdf', 'application/pdf', authToken)
      if (res.status === 400 && res.data?.success === false) {
        logPass('Oversized File Rejection', `status=400, code=${res.data?.error?.code}`)
      } else {
        throw new Error(`Expected 400 rejection for oversized file, got ${res.status}: ${JSON.stringify(res.data)}`)
      }
    } catch (err) {
      logFail('Oversized File Rejection', err)
    }

    // 17. Duplicate upload rejected with 409 DUPLICATE_DOCUMENT
    try {
      const res = await uploadFileRequest('/api/documents/upload', validPdfBytes, 'sample.pdf', 'application/pdf', authToken)
      if (res.status === 409 && res.data?.success === false && res.data?.error?.code === 'DUPLICATE_DOCUMENT') {
        logPass('Duplicate Document Rejection', `status=409, code=${res.data.error.code}`)
      } else {
        throw new Error(`Expected 409 DUPLICATE_DOCUMENT, got ${res.status}: ${JSON.stringify(res.data)}`)
      }
    } catch (err) {
      logFail('Duplicate Document Rejection', err)
    }

    // 18. Cross-user isolation: User B cannot read User A's document or file
    try {
      const userBEmail = `user_b_${Date.now()}@example.com`
      const regRes = await request('/api/auth/register', {
        method: 'POST',
        body: {
          name: 'User B',
          email: userBEmail,
          password: testPassword,
          confirmPassword: testPassword,
        },
      })
      const userBToken = regRes.data?.token
      userBId = regRes.data?.user?.id

      // User B tries GET /api/documents/:id -> 404
      const resDoc = await request(`/api/documents/${uploadedDocId}`, {
        headers: { Authorization: `Bearer ${userBToken}` },
      })
      // User B tries GET /api/documents/:id/file -> 404
      const resFile = await request(`/api/documents/${uploadedDocId}/file`, {
        headers: { Authorization: `Bearer ${userBToken}` },
      })

      if (
        resDoc.status === 404 &&
        resDoc.data?.error?.code === 'NOT_FOUND' &&
        resFile.status === 404 &&
        resFile.data?.error?.code === 'NOT_FOUND'
      ) {
        logPass('Cross-User Isolation (User B Access Denied)', 'Both document and file returned 404 NOT_FOUND to User B')
      } else {
        throw new Error(`Expected 404 NOT_FOUND for User B, got doc=${resDoc.status}, file=${resFile.status}`)
      }
    } catch (err) {
      logFail('Cross-User Isolation (User B Access Denied)', err)
    }

    // 19. User A file streaming inline
    try {
      const fileRes = await fetch(`${BASE_URL}/api/documents/${uploadedDocId}/file`, {
        headers: { Authorization: `Bearer ${authToken}` },
      })
      const contentType = fileRes.headers.get('content-type')
      const arrayBuffer = await fileRes.arrayBuffer()
      const downloadedBuffer = Buffer.from(arrayBuffer)
      if (
        fileRes.status === 200 &&
        contentType?.includes('application/pdf') &&
        downloadedBuffer.equals(validPdfBytes)
      ) {
        logPass('GET /api/documents/:id/file (Streaming)', `status=200, Content-Type=${contentType}, bytes=${downloadedBuffer.length}`)
      } else {
        throw new Error(`Expected 200 PDF stream matching upload bytes, got status=${fileRes.status}, type=${contentType}`)
      }
    } catch (err) {
      logFail('GET /api/documents/:id/file (Streaming)', err)
    }

    // 20. Notarization Request OK & Duplicate 409
    try {
      // First request -> 201 Created
      const req1 = await request('/api/notarization/request', {
        method: 'POST',
        headers: { Authorization: `Bearer ${authToken}` },
        body: { documentId: uploadedDocId },
      })

      if (req1.status === 201 && req1.data?.success === true && req1.data?.notarization?.status === 'REQUESTED') {
        logPass('POST /api/notarization/request (First Attempt)', `status=201, Notarization ID: ${req1.data.notarization.id}`)
      } else {
        throw new Error(`Expected 201 REQUESTED, got ${req1.status}: ${JSON.stringify(req1.data)}`)
      }

      // Second duplicate request -> 409 Conflict
      const req2 = await request('/api/notarization/request', {
        method: 'POST',
        headers: { Authorization: `Bearer ${authToken}` },
        body: { documentId: uploadedDocId },
      })

      if (req2.status === 409 && req2.data?.success === false && req2.data?.error?.code === 'DUPLICATE_REQUEST') {
        logPass('POST /api/notarization/request (Duplicate Rejection)', `status=409, code=${req2.data.error.code}`)
      } else {
        throw new Error(`Expected 409 DUPLICATE_REQUEST, got ${req2.status}: ${JSON.stringify(req2.data)}`)
      }
    } catch (err) {
      logFail('POST /api/notarization/request', err)
    }

    // 21. Stats Numbers Correct
    try {
      const statsRes = await request('/api/documents/stats', {
        headers: { Authorization: `Bearer ${authToken}` },
      })
      if (
        statsRes.status === 200 &&
        statsRes.data?.success === true &&
        statsRes.data?.total >= 1 &&
        statsRes.data?.pending >= 1 &&
        statsRes.data?.notarized === 0
      ) {
        logPass('GET /api/documents/stats', `total=${statsRes.data.total}, pending=${statsRes.data.pending}, notarized=${statsRes.data.notarized}`)
      } else {
        throw new Error(`Stats mismatch: ${JSON.stringify(statsRes.data)}`)
      }
    } catch (err) {
      logFail('GET /api/documents/stats', err)
    }

    // 22. Direct Database & Model Validation Checks
    console.log('\n--- Direct Database & Model Integrity Checks ---')
    let testDocId: any = null
    let testNotarizationId: any = null
    const dummyHash = 'b'.repeat(64)

    try {
      // 22a. Create Document
      const doc = await DocumentModel.create({
        ownerId: new mongoose.Types.ObjectId(createdUserId),
        fileName: 'contract.pdf',
        originalName: 'contract_v1.pdf',
        mimeType: 'application/pdf',
        fileSize: 1024,
        sha256Hash: dummyHash,
        status: 'PENDING',
        visibility: 'PRIVATE',
      })
      testDocId = doc._id
      logPass('Mongoose Document Creation', `Document ID: ${doc._id}`)

      // 22b. Reject duplicate (ownerId, sha256Hash)
      let duplicateRejected = false
      try {
        await DocumentModel.create({
          ownerId: new mongoose.Types.ObjectId(createdUserId),
          fileName: 'contract_duplicate.pdf',
          originalName: 'contract_duplicate.pdf',
          mimeType: 'application/pdf',
          fileSize: 1024,
          sha256Hash: dummyHash,
          status: 'PENDING',
        })
      } catch (err: any) {
        if (err.code === 11000) {
          duplicateRejected = true
        }
      }

      if (duplicateRejected) {
        logPass('Compound Index Duplicate Rejection', 'Compound unique index (ownerId, sha256Hash) triggered E11000')
      } else {
        throw new Error('Expected duplicate (ownerId, sha256Hash) to be rejected with code 11000')
      }

      // 22c. Reject invalid wallet address format
      let badWalletRejected = false
      try {
        await User.create({
          name: 'Bad Wallet User',
          email: `bad_wallet_${Date.now()}@example.com`,
          passwordHash: 'dummyhash123',
          walletAddress: '0xnot-a-valid-eth-address',
        })
      } catch (err: any) {
        if (err.name === 'ValidationError') {
          badWalletRejected = true
        }
      }

      if (badWalletRejected) {
        logPass('Wallet Address Regex Validation', 'Rejected malformed Ethereum address')
      } else {
        throw new Error('Expected invalid wallet address to fail Mongoose schema validation')
      }

      // 22d. Create Notarization
      const notarization = await Notarization.create({
        documentId: testDocId,
        requestedBy: new mongoose.Types.ObjectId(createdUserId),
        documentHash: dummyHash,
        status: 'REQUESTED',
      })
      testNotarizationId = notarization._id
      logPass('Mongoose Notarization Creation', `Notarization ID: ${notarization._id}`)
    } catch (err) {
      logFail('Model Integrity Checks', err)
    } finally {
      // 23. Data cleanup
      if (testDocId) await DocumentModel.deleteOne({ _id: testDocId })
      if (testNotarizationId) await Notarization.deleteOne({ _id: testNotarizationId })
      if (uploadedDocId) {
        await DocumentModel.deleteOne({ _id: uploadedDocId })
        await Notarization.deleteMany({ documentId: uploadedDocId })
        const diskFiles = [
          path.resolve(process.cwd(), 'uploads', `${uploadedDocId}.pdf`),
          path.resolve(__dirname, '../uploads', `${uploadedDocId}.pdf`),
        ]
        for (const diskFile of diskFiles) {
          if (fs.existsSync(diskFile)) {
            try {
              fs.unlinkSync(diskFile)
            } catch {
              // ignore
            }
          }
        }
      }
      if (createdUserId) await User.deleteOne({ _id: createdUserId })
      if (userBId) await User.deleteOne({ _id: userBId })
      logPass('Test Data Cleanup', 'Cleaned up temporary users, documents, disk uploads, and notarizations')
    }
  } finally {
    // Teardown isolated test server if started
    if (server) {
      await new Promise<void>((resolve) => {
        server?.close(() => resolve())
      })
      console.log('🛑 Isolated test server stopped.')
    }

    // Teardown lingering disk upload file if any
    if (uploadedDocId) {
      const diskFiles = [
        path.resolve(process.cwd(), 'uploads', `${uploadedDocId}.pdf`),
        path.resolve(__dirname, '../uploads', `${uploadedDocId}.pdf`),
      ]
      for (const diskFile of diskFiles) {
        if (fs.existsSync(diskFile)) {
          try {
            fs.unlinkSync(diskFile)
          } catch {
            // ignore
          }
        }
      }
    }

    // Drop gohash_test database at the end of the run and disconnect
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

runSmokeTests().catch((err) => {
  console.error('Fatal error during smoke test execution:', err)
  process.exit(1)
})
