import http from 'http'
import mongoose from 'mongoose'
import app from '../src/app'
import { connectDB, disconnectDB } from '../src/config/db'
import { env } from '../src/config/env'
import { User } from '../src/models/User'
import { DocumentModel } from '../src/models/Document'
import { Notarization } from '../src/models/Notarization'

const TEST_PORT = env.PORT || 5000
const BASE_URL = `http://127.0.0.1:${TEST_PORT}`

let server: http.Server | null = null
let testsPassed = 0
let testsFailed = 0

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

async function isServerRunning(): Promise<boolean> {
  try {
    const res = await fetch(`${BASE_URL}/api/health`)
    return res.status === 200
  } catch {
    return false
  }
}

async function runSmokeTests() {
  console.log('\n========================================')
  console.log('       GoHash Backend Smoke Test        ')
  console.log('========================================\n')

  const alreadyRunning = await isServerRunning()

  if (alreadyRunning) {
    console.log(`ℹ️  Targeting existing active server on ${BASE_URL}`)
    await connectDB()
  } else {
    console.log(`ℹ️  No active server detected. Starting embedded server on port ${TEST_PORT}...`)
    await connectDB()
    await new Promise<void>((resolve) => {
      server = app.listen(TEST_PORT, () => {
        resolve()
      })
    })
    console.log(`🚀 Embedded test server running on ${BASE_URL}`)
  }

  const testEmail = `smoke_test_${Date.now()}@example.com`
  const testPassword = 'Password123!'
  let authToken = ''
  let createdUserId = ''

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

    // 2. 404 Not Found error envelope
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

    // 3. 501 Not Implemented stub
    try {
      const res = await request('/api/documents/upload', { method: 'POST', body: {} })
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

      if (res.status === 201 && res.data?.success === true && res.data?.token && res.data?.user?.email === testEmail) {
        authToken = res.data.token
        createdUserId = res.data.user.id
        logPass('POST /api/auth/register', `User ID: ${createdUserId}, role: ${res.data.user.role}`)
      } else {
        throw new Error(`Expected 201 with token and user, got ${res.status}: ${JSON.stringify(res.data)}`)
      }
    } catch (err) {
      logFail('POST /api/auth/register', err)
    }

    // 5. Duplicate email rejection
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

      if ((res.status === 409 || res.status === 400) && res.data?.success === false) {
        logPass('Duplicate Email Rejection', `status=${res.status}, code=${res.data.error?.code}`)
      } else {
        throw new Error(`Expected 409/400 for duplicate email, got ${res.status}: ${JSON.stringify(res.data)}`)
      }
    } catch (err) {
      logFail('Duplicate Email Rejection', err)
    }

    // 6. Role in body ignored
    const roleTamperEmail = `role_tamper_${Date.now()}@example.com`
    try {
      const res = await request('/api/auth/register', {
        method: 'POST',
        body: {
          name: 'Hacker User',
          email: roleTamperEmail,
          password: testPassword,
          confirmPassword: testPassword,
          role: 'ADMIN', // Should be strictly ignored!
        },
      })

      if (res.status === 201 && res.data?.user?.role === 'USER') {
        logPass('Role In Body Ignored', `Assigned role is strictly "${res.data.user.role}"`)
        // Clean up immediately
        await User.deleteOne({ email: roleTamperEmail })
      } else {
        throw new Error(`Expected role to remain USER, got: ${res.data?.user?.role}`)
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
        authToken = res.data.token // update token
        logPass('POST /api/auth/login', 'Received valid JWT token')
      } else {
        throw new Error(`Expected 200 with JWT, got ${res.status}: ${JSON.stringify(res.data)}`)
      }
    } catch (err) {
      logFail('POST /api/auth/login', err)
    }

    // 8. Wrong password rejected
    try {
      const res = await request('/api/auth/login', {
        method: 'POST',
        body: {
          email: testEmail,
          password: 'WrongPassword999!',
        },
      })

      if (res.status === 401 && res.data?.success === false && res.data?.error?.code === 'INVALID_CREDENTIALS') {
        logPass('Wrong Password Rejection', 'Generic 401 error returned')
      } else {
        throw new Error(`Expected 401 generic rejection, got ${res.status}: ${JSON.stringify(res.data)}`)
      }
    } catch (err) {
      logFail('Wrong Password Rejection', err)
    }

    // 9. /me without token
    try {
      const res = await request('/api/auth/me')
      if (res.status === 401 && res.data?.success === false && res.data?.error?.code === 'UNAUTHORIZED') {
        logPass('GET /api/auth/me (No Token)', 'Blocked 401 UNAUTHORIZED')
      } else {
        throw new Error(`Expected 401, got ${res.status}: ${JSON.stringify(res.data)}`)
      }
    } catch (err) {
      logFail('GET /api/auth/me (No Token)', err)
    }

    // 10. /me with token
    try {
      const res = await request('/api/auth/me', {
        headers: { Authorization: `Bearer ${authToken}` },
      })

      if (res.status === 200 && res.data?.success === true && res.data?.user?.email === testEmail) {
        logPass('GET /api/auth/me (With Token)', `Fetched user ${res.data.user.email}`)
      } else {
        throw new Error(`Expected 200 with user, got ${res.status}: ${JSON.stringify(res.data)}`)
      }
    } catch (err) {
      logFail('GET /api/auth/me (With Token)', err)
    }

    // 11. PATCH /api/auth/wallet
    const testWallet = '0x1234567890123456789012345678901234567890'
    try {
      const res = await request('/api/auth/wallet', {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${authToken}` },
        body: { walletAddress: testWallet },
      })

      if (res.status === 200 && res.data?.success === true && res.data?.user?.walletAddress === testWallet) {
        logPass('PATCH /api/auth/wallet', `Wallet stored: ${testWallet}`)
      } else {
        throw new Error(`Expected 200 with walletAddress, got ${res.status}: ${JSON.stringify(res.data)}`)
      }
    } catch (err) {
      logFail('PATCH /api/auth/wallet', err)
    }

    // 12. RBAC check: Regular USER blocked from requireRole('ADMIN')
    try {
      const res = await request('/api/auth/test-admin', {
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

    // 13. Direct Database & Model Validation Checks
    console.log('\n--- Direct Database & Model Integrity Checks ---')
    let testDocId: any = null
    let testNotarizationId: any = null
    const dummyHash = 'a'.repeat(64)

    try {
      // 13a. Create Document
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

      // 13b. Reject duplicate (ownerId, sha256Hash)
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

      // 13c. Reject invalid wallet address format
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

      // 13d. Create Notarization
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
      // 14. Data cleanup
      if (testDocId) await DocumentModel.deleteOne({ _id: testDocId })
      if (testNotarizationId) await Notarization.deleteOne({ _id: testNotarizationId })
      if (createdUserId) await User.deleteOne({ _id: createdUserId })
      logPass('Test Data Cleanup', 'Cleaned up temporary users, documents, and notarizations')
    }
  } finally {
    // Teardown embedded server if started
    if (server) {
      await new Promise<void>((resolve) => {
        server?.close(() => resolve())
      })
      console.log('🛑 Embedded test server stopped.')
    }
    await disconnectDB()
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
