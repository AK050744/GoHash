/**
 * scripts/rbac-test.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Complete RBAC Matrix & Security Audit Test for GoHash API
 *
 * Requirements:
 * 1. RBAC matrix: Test EVERY endpoint in docs/API_CONTRACT.md under
 *    anonymous, USER, NOTARY, and ADMIN roles.
 * 2. Ownership isolation: Verify that another user (stranger) gets 404 (not 403)
 *    and cannot learn that the document or notarization exists.
 * 3. Auth rate limit: Verify 429 appears on login when limit is exceeded.
 * 4. Sensitive field check: Verify no response exposes passwordHash or walletNonce.
 * 5. Isolation: Uses in-process app on ephemeral port, MONGODB_URI_TEST,
 *    and drops test database on completion.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import http from 'http'
import crypto from 'crypto'
import fs from 'fs'
import path from 'path'
import mongoose from 'mongoose'
import { ethers } from 'ethers'

// Pre-configure environment so rate limits don't block matrix calls
process.env.AUTH_RATE_LIMIT_MAX = '1000'
process.env.AUTH_RATE_LIMIT_WINDOW_MIN = '15'
process.env.VERIFY_RATE_LIMIT_PER_MIN = '1000'

import app from '../src/app'
import { env } from '../src/config/env'
import { User } from '../src/models/User'
import { DocumentModel } from '../src/models/Document'
import { Notarization } from '../src/models/Notarization'
import { BlockchainService } from '../src/services/blockchain.service'

env.AUTH_RATE_LIMIT_MAX = 1000
env.VERIFY_RATE_LIMIT_PER_MIN = 1000

let server: http.Server | null = null
let BASE_URL = ''
let matrixPassed = 0
let matrixFailed = 0
let checksPassed = 0
let checksFailed = 0

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
  console.error(`Refusing to run RBAC test: database name "${dbName}" in MONGODB_URI_TEST must end with "_test".`)
  process.exit(1)
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function request(
  path: string,
  options: {
    method?: string
    headers?: Record<string, string>
    body?: Record<string, unknown>
    token?: string | null
  } = {}
): Promise<{ status: number; data: any }> {
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

  // Automated security check on EVERY response
  if (data) {
    checkForSensitiveFields(data, `${method} ${path}`)
  }

  return { status: res.status, data }
}

async function uploadPdf(
  path: string,
  pdfBuffer: Buffer,
  filename: string,
  token?: string | null
): Promise<{ status: number; data: any }> {
  const formData = new FormData()
  formData.append('file', new Blob([pdfBuffer], { type: 'application/pdf' }), filename)
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

  if (data) {
    checkForSensitiveFields(data, `POST ${path} (upload)`)
  }

  return { status: res.status, data }
}

const FORBIDDEN_KEYS = ['passwordHash', 'walletNonce', 'walletNonceExpiry']
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
    if (FORBIDDEN_KEYS.includes(key) || (key.toLowerCase() === 'nonce' && typeof value === 'string' && value.length >= 16)) {
      throw new Error(`[SECURITY LEAK] Forbidden field "${key}" exposed in response for ${context}!`)
    }
    if (typeof value === 'object') {
      checkForSensitiveFields(value, context, visited)
    }
  }
}

// Minimal valid PDF generator
function createTestPdf(content: string): Buffer {
  return Buffer.from(
    `%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n3 0 obj\n<< /Type /Page /Parent 2 0 R /Contents 4 0 R >>\nendobj\n4 0 obj\n<< /Length ${content.length} >>\nstream\n${content}\nendstream\nendobj\nxref\n0 5\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \n0000000185 00000 n \ntrailer\n<< /Size 5 /Root 1 0 R >>\nstartxref\n300\n%%EOF`
  )
}

// Helper: link a wallet to a user via the challenge nonce flow
async function linkWallet(userToken: string, signer: ethers.Signer) {
  const signerAddress = await signer.getAddress()
  const nonceRes = await request('/api/auth/wallet/nonce', {
    method: 'POST',
    token: userToken,
  })
  if (nonceRes.status !== 200 || !nonceRes.data?.message) {
    throw new Error(`Failed to obtain nonce: ${JSON.stringify(nonceRes.data)}`)
  }
  const signature = await signer.signMessage(nonceRes.data.message)
  const patchRes = await request('/api/auth/wallet', {
    method: 'PATCH',
    token: userToken,
    body: { walletAddress: signerAddress, signature },
  })
  if (patchRes.status !== 200) {
    throw new Error(`Failed to link wallet ${signerAddress}: ${patchRes.status} ${JSON.stringify(patchRes.data)}`)
  }
  return patchRes
}

// ─── Main RBAC Suite ─────────────────────────────────────────────────────────

async function runRbacTests() {
  console.log('\n================================================================================')
  console.log('         GoHash — RBAC Matrix & Security Quality Audit Suite')
  console.log('================================================================================')
  console.log(`Database: ${dbName}`)

  // 1. Fail-fast MongoDB connection
  try {
    await mongoose.connect(MONGODB_URI_TEST, { serverSelectionTimeoutMS: 4000 })
    console.log('✅ Connected to MongoDB test database.')
    // Start with a clean slate
    await mongoose.connection.dropDatabase()
  } catch (err: any) {
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

  // ─── Step 1: Auth Rate Limiting Test (Fresh IP state) ────────────────────────
  console.log('--- Auth Rate Limiting Test (POST /api/auth/login) ---')
  try {
    env.AUTH_RATE_LIMIT_MAX = 2

    const attempt1 = await request('/api/auth/login', {
      method: 'POST',
      body: { email: 'nonexistent@example.com', password: 'WrongPassword123!' },
    })
    const attempt2 = await request('/api/auth/login', {
      method: 'POST',
      body: { email: 'nonexistent@example.com', password: 'WrongPassword123!' },
    })
    const attempt3 = await request('/api/auth/login', {
      method: 'POST',
      body: { email: 'nonexistent@example.com', password: 'WrongPassword123!' },
    })

    // Immediately restore high rate limit for all subsequent tests
    env.AUTH_RATE_LIMIT_MAX = 1000

    if (
      attempt1.status === 401 &&
      attempt2.status === 401 &&
      attempt3.status === 429 &&
      attempt3.data?.error?.code === 'RATE_LIMITED'
    ) {
      checksPassed++
      console.log('  \x1b[32m✔ PASS\x1b[0m [Auth Rate Limit] Exceeded attempts trigger 429 RATE_LIMITED')
    } else {
      checksFailed++
      console.error(
        `  \x1b[31m✘ FAIL\x1b[0m [Auth Rate Limit] Expected [401, 401, 429], got [${attempt1.status}, ${attempt2.status}, ${attempt3.status}]: ${JSON.stringify(attempt3.data)}`
      )
    }
  } catch (err) {
    checksFailed++
    console.error('  \x1b[31m✘ FAIL\x1b[0m [Auth Rate Limit]', err)
  }

  // Hardhat provider & accounts
  const provider = new ethers.JsonRpcProvider(env.RPC_URL)
  const signer0 = await provider.getSigner(0) // deployer
  const signer1 = await provider.getSigner(1) // notary
  const signer2 = await provider.getSigner(2) // user1
  const signerNotaryAddress = await signer1.getAddress()
  const signerUser1Address  = await signer2.getAddress()

  // Ensure signer1 is authorized as notary on-chain
  try {
    const isAuth = await BlockchainService.isNotaryAuthorized(signerNotaryAddress)
    if (!isAuth) {
      const contractOwner = BlockchainService.getContract(signer0)
      const tx = await contractOwner.addNotary(signerNotaryAddress)
      await tx.wait()
    }
  } catch {
    // If Hardhat is unreachable, note for blockchain endpoints
  }

  const testPassword = 'TestPassword123!'

  // 3. Create test accounts
  const timestamp = Date.now()
  const user1Email   = `user1_rbac_${timestamp}@example.com`
  const user2Email   = `user2_rbac_${timestamp}@example.com`
  const notaryEmail  = `notary_rbac_${timestamp}@example.com`
  const adminEmail   = `admin_rbac_${timestamp}@example.com`

  // Register user1 (owner)
  const regUser1 = await request('/api/auth/register', {
    method: 'POST',
    body: { name: 'RBAC User 1', email: user1Email, password: testPassword, confirmPassword: testPassword },
  })
  const user1Token = regUser1.data?.token
  const user1Id    = regUser1.data?.user?.id

  // Register user2 (stranger)
  const regUser2 = await request('/api/auth/register', {
    method: 'POST',
    body: { name: 'RBAC User 2', email: user2Email, password: testPassword, confirmPassword: testPassword },
  })
  const user2Token = regUser2.data?.token
  const user2Id    = regUser2.data?.user?.id

  // Register notary, elevate role in DB, login
  const regNotary = await request('/api/auth/register', {
    method: 'POST',
    body: { name: 'RBAC Notary', email: notaryEmail, password: testPassword, confirmPassword: testPassword },
  })
  const notaryId = regNotary.data?.user?.id
  await User.updateOne({ _id: notaryId }, { role: 'NOTARY' })
  const loginNotary = await request('/api/auth/login', {
    method: 'POST',
    body: { email: notaryEmail, password: testPassword },
  })
  const notaryToken = loginNotary.data?.token

  // Register admin, elevate role in DB, login
  const regAdmin = await request('/api/auth/register', {
    method: 'POST',
    body: { name: 'RBAC Admin', email: adminEmail, password: testPassword, confirmPassword: testPassword },
  })
  const adminId = regAdmin.data?.user?.id
  await User.updateOne({ _id: adminId }, { role: 'ADMIN' })
  const loginAdmin = await request('/api/auth/login', {
    method: 'POST',
    body: { email: adminEmail, password: testPassword },
  })
  const adminToken = loginAdmin.data?.token

  // Link wallets
  // User 1 links signer2
  await linkWallet(user1Token, signer2)

  // Notary links signer1
  await linkWallet(notaryToken, signer1)

  // Seed documents:
  // Doc 1: Uploaded by user 1, will have a notarization request
  const pdf1 = createTestPdf(`RBAC doc 1 ${timestamp}`)
  const up1 = await uploadPdf('/api/documents/upload', pdf1, 'rbac_test_1.pdf', user1Token)
  const doc1Id = up1.data?.document?.id

  // Request notarization for doc1 -> notarization1
  const reqNot1 = await request('/api/notarization/request', {
    method: 'POST',
    token: user1Token,
    body: { documentId: doc1Id },
  })
  const notarization1Id = reqNot1.data?.notarization?.id

  // Doc 2: Uploaded by user 1, in PENDING status (ready for another request test)
  const pdf2 = createTestPdf(`RBAC doc 2 ${timestamp}`)
  const up2 = await uploadPdf('/api/documents/upload', pdf2, 'rbac_test_2.pdf', user1Token)
  const doc2Id = up2.data?.document?.id

  // Doc 3: For reject test
  const pdf3 = createTestPdf(`RBAC doc 3 ${timestamp}`)
  const up3 = await uploadPdf('/api/documents/upload', pdf3, 'rbac_test_3.pdf', user1Token)
  const doc3Id = up3.data?.document?.id
  const reqNot3 = await request('/api/notarization/request', {
    method: 'POST',
    token: user1Token,
    body: { documentId: doc3Id },
  })
  const notarization3Id = reqNot3.data?.notarization?.id

  // Prepare approved notarization for confirm test
  const pdf4 = createTestPdf(`RBAC doc 4 ${timestamp}`)
  const up4 = await uploadPdf('/api/documents/upload', pdf4, 'rbac_test_4.pdf', user1Token)
  const doc4Id = up4.data?.document?.id
  const reqNot4 = await request('/api/notarization/request', {
    method: 'POST',
    token: user1Token,
    body: { documentId: doc4Id },
  })
  const notarization4Id = reqNot4.data?.notarization?.id
  await request(`/api/notarization/${notarization4Id}/approve`, {
    method: 'POST',
    token: notaryToken,
  })

  console.log('\n--------------------------------------------------------------------------------')
  console.log('                    RBAC Matrix Test (28 API Endpoints)')
  console.log('--------------------------------------------------------------------------------')

  type EndpointSpec = {
    id: number
    method: string
    route: string
    expected: [number, number, number, number] // [Anon, USER, NOTARY, ADMIN]
    call: (token: string | null, role: string) => Promise<number>
  }

  const endpoints: EndpointSpec[] = [
    {
      id: 1,
      method: 'GET',
      route: '/api/health',
      expected: [200, 200, 200, 200],
      call: async (token) => (await request('/api/health', { token })).status,
    },
    {
      id: 2,
      method: 'POST',
      route: '/api/auth/register',
      expected: [201, 201, 201, 201],
      call: async () => {
        const email = `reg_${Date.now()}_${crypto.randomBytes(3).toString('hex')}@example.com`
        return (
          await request('/api/auth/register', {
            method: 'POST',
            body: { name: 'Reg Test', email, password: testPassword, confirmPassword: testPassword },
          })
        ).status
      },
    },
    {
      id: 3,
      method: 'POST',
      route: '/api/auth/login',
      expected: [200, 200, 200, 200],
      call: async () => {
        return (
          await request('/api/auth/login', {
            method: 'POST',
            body: { email: user1Email, password: testPassword },
          })
        ).status
      },
    },
    {
      id: 4,
      method: 'GET',
      route: '/api/auth/me',
      expected: [401, 200, 200, 200],
      call: async (token) => (await request('/api/auth/me', { token })).status,
    },
    {
      id: 5,
      method: 'POST',
      route: '/api/auth/wallet/nonce',
      expected: [401, 200, 200, 200],
      call: async (token) => (await request('/api/auth/wallet/nonce', { method: 'POST', token })).status,
    },
    {
      id: 6,
      method: 'PATCH',
      route: '/api/auth/wallet',
      expected: [401, 400, 400, 400],
      call: async (token) =>
        (
          await request('/api/auth/wallet', {
            method: 'PATCH',
            token,
            body: { walletAddress: '0x1234567890123456789012345678901234567890' },
          })
        ).status,
    },
    {
      id: 7,
      method: 'POST',
      route: '/api/documents/upload',
      expected: [401, 201, 201, 201],
      call: async (token) => {
        const pdf = createTestPdf(`upload-matrix-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`)
        return (await uploadPdf('/api/documents/upload', pdf, 'matrix.pdf', token)).status
      },
    },
    {
      id: 8,
      method: 'GET',
      route: '/api/documents/stats',
      expected: [401, 200, 200, 200],
      call: async (token) => (await request('/api/documents/stats', { token })).status,
    },
    {
      id: 9,
      method: 'GET',
      route: '/api/documents',
      expected: [401, 200, 200, 200],
      call: async (token) => (await request('/api/documents', { token })).status,
    },
    {
      id: 10,
      method: 'GET',
      route: '/api/documents/:id',
      expected: [401, 200, 200, 200], // user1 is owner -> 200, notary -> 200, admin -> 200
      call: async (token) => (await request(`/api/documents/${doc1Id}`, { token })).status,
    },
    {
      id: 11,
      method: 'GET',
      route: '/api/documents/:id/file',
      expected: [401, 200, 200, 200], // user1 is owner -> 200, notary -> 200, admin -> 200
      call: async (token) => (await request(`/api/documents/${doc1Id}/file`, { token })).status,
    },
    {
      id: 12,
      method: 'POST',
      route: '/api/notarization/request',
      expected: [401, 201, 404, 404], // doc2 owned by user1 -> anon: 401, user1 (owner): 201, notary/admin (not owner): 404
      call: async (token, role) => {
        if (role === 'USER') {
          return (
            await request('/api/notarization/request', {
              method: 'POST',
              token,
              body: { documentId: doc2Id },
            })
          ).status
        }
        return (
          await request('/api/notarization/request', {
            method: 'POST',
            token,
            body: { documentId: doc2Id },
          })
        ).status
      },
    },
    {
      id: 13,
      method: 'GET',
      route: '/api/notarization/pending',
      expected: [401, 403, 200, 200],
      call: async (token) => (await request('/api/notarization/pending', { token })).status,
    },
    {
      id: 14,
      method: 'GET',
      route: '/api/notarization',
      expected: [401, 200, 200, 200],
      call: async (token) => (await request('/api/notarization', { token })).status,
    },
    {
      id: 15,
      method: 'GET',
      route: '/api/notarization/:id',
      expected: [401, 200, 200, 200], // user1 is owner -> 200, notary -> 200, admin -> 200
      call: async (token) => (await request(`/api/notarization/${notarization1Id}`, { token })).status,
    },
    {
      id: 16,
      method: 'POST',
      route: '/api/notarization/:id/approve',
      expected: [401, 403, 200, 403],
      call: async (token) => (await request(`/api/notarization/${notarization1Id}/approve`, { method: 'POST', token })).status,
    },
    {
      id: 17,
      method: 'POST',
      route: '/api/notarization/:id/reject',
      expected: [401, 403, 200, 403],
      call: async (token) =>
        (
          await request(`/api/notarization/${notarization3Id}/reject`, {
            method: 'POST',
            token,
            body: { reason: 'Test rejection in RBAC matrix' },
          })
        ).status,
    },
    {
      id: 18,
      method: 'POST',
      route: '/api/notarization/:id/confirm',
      expected: [401, 403, 422, 403], // NOTARY reaches confirmation logic (returns 422 for dummy hash), anon 401, USER 403, ADMIN 403
      call: async (token) =>
        (
          await request(`/api/notarization/${notarization4Id}/confirm`, {
            method: 'POST',
            token,
            body: { transactionHash: '0x' + 'a'.repeat(64) },
          })
        ).status,
    },
    {
      id: 19,
      method: 'GET',
      route: '/api/blockchain/contract',
      expected: [401, 403, 403, 200],
      call: async (token) => (await request('/api/blockchain/contract', { token })).status,
    },
    {
      id: 20,
      method: 'GET',
      route: '/api/blockchain/:documentId',
      expected: [401, 200, 200, 200], // user1 is owner -> 200, notary -> 200, admin -> 200
      call: async (token) => (await request(`/api/blockchain/${doc1Id}`, { token })).status,
    },
    {
      id: 21,
      method: 'POST',
      route: '/api/verify',
      expected: [200, 200, 200, 200],
      call: async (token) => {
        const pdf = createTestPdf(`verify-matrix-${Date.now()}`)
        return (await uploadPdf('/api/verify', pdf, 'verify.pdf', token)).status
      },
    },
    {
      id: 22,
      method: 'GET',
      route: '/api/verify/hash/:sha256',
      expected: [200, 200, 200, 200],
      call: async (token) =>
        (
          await request(
            '/api/verify/hash/e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
            { token }
          )
        ).status,
    },
    {
      id: 23,
      method: 'GET',
      route: '/api/admin/users',
      expected: [401, 403, 403, 200],
      call: async (token) => (await request('/api/admin/users', { token })).status,
    },
    {
      id: 24,
      method: 'PATCH',
      route: '/api/admin/users/:id/role',
      expected: [401, 403, 403, 200],
      call: async (token) =>
        (
          await request(`/api/admin/users/${user2Id}/role`, {
            method: 'PATCH',
            token,
            body: { role: 'NOTARY' },
          })
        ).status,
    },
    {
      id: 25,
      method: 'PATCH',
      route: '/api/admin/users/:id/status',
      expected: [401, 403, 403, 200],
      call: async (token) =>
        (
          await request(`/api/admin/users/${user2Id}/status`, {
            method: 'PATCH',
            token,
            body: { isActive: true },
          })
        ).status,
    },
    {
      id: 26,
      method: 'GET',
      route: '/api/admin/notaries',
      expected: [401, 403, 403, 200],
      call: async (token) => (await request('/api/admin/notaries', { token })).status,
    },
    {
      id: 27,
      method: 'GET',
      route: '/api/admin/activity',
      expected: [401, 403, 403, 200],
      call: async (token) => (await request('/api/admin/activity', { token })).status,
    },
    {
      id: 28,
      method: 'GET',
      route: '/api/admin/stats',
      expected: [401, 403, 403, 200],
      call: async (token) => (await request('/api/admin/stats', { token })).status,
    },
  ]

  console.log(
    `| #  | Method | Endpoint                        | Anon | USER | NOTARY | ADMIN | Match |`
  )
  console.log(
    `|:---|:-------|:--------------------------------|:----:|:----:|:------:|:-----:|:-----:|`
  )

  const tokens = {
    ANON: null,
    USER: user1Token,
    NOTARY: notaryToken,
    ADMIN: adminToken,
  }

  for (const ep of endpoints) {
    const actualAnon   = await ep.call(tokens.ANON, 'ANON')
    const actualUser   = await ep.call(tokens.USER, 'USER')
    const actualNotary = await ep.call(tokens.NOTARY, 'NOTARY')
    const actualAdmin  = await ep.call(tokens.ADMIN, 'ADMIN')

    const actual = [actualAnon, actualUser, actualNotary, actualAdmin]
    const matches =
      actual[0] === ep.expected[0] &&
      actual[1] === ep.expected[1] &&
      actual[2] === ep.expected[2] &&
      actual[3] === ep.expected[3]

    if (matches) {
      matrixPassed++
    } else {
      matrixFailed++
    }

    const routePadded = ep.route.padEnd(31, ' ')
    const methodPadded = ep.method.padEnd(6, ' ')
    const matchStr = matches ? '\x1b[32m✔ PASS\x1b[0m' : '\x1b[31m✘ FAIL\x1b[0m'

    console.log(
      `| ${String(ep.id).padStart(2, ' ')} | ${methodPadded} | ${routePadded} |  ${actualAnon} |  ${actualUser} |   ${actualNotary}  |  ${actualAdmin}  | ${matchStr} |`
    )

    if (!matches) {
      console.error(
        `   ❌ Mismatch on ${ep.method} ${ep.route}: Expected [${ep.expected.join(', ')}], Got [${actual.join(', ')}]`
      )
    }
  }

  console.log('--------------------------------------------------------------------------------\n')

  // ─── Section 2: Ownership Route Isolation Tests ──────────────────────────────
  console.log('--- Ownership Route Isolation Tests (Stranger USER2 -> 404 NOT_FOUND) ---')
  const ownershipRoutes = [
    { name: 'GET /api/documents/:id', run: () => request(`/api/documents/${doc1Id}`, { token: user2Token }) },
    { name: 'GET /api/documents/:id/file', run: () => request(`/api/documents/${doc1Id}/file`, { token: user2Token }) },
    { name: 'POST /api/notarization/request (doc owned by another)', run: () => request('/api/notarization/request', { method: 'POST', token: user2Token, body: { documentId: doc1Id } }) },
    { name: 'GET /api/notarization/:id', run: () => request(`/api/notarization/${notarization1Id}`, { token: user2Token }) },
    { name: 'GET /api/blockchain/:documentId', run: () => request(`/api/blockchain/${doc1Id}`, { token: user2Token }) },
  ]

  for (const ow of ownershipRoutes) {
    const res = await ow.run()
    if (res.status === 404 && res.data?.error?.code === 'NOT_FOUND') {
      checksPassed++
      console.log(`  \x1b[32m✔ PASS\x1b[0m [${ow.name}] Stranger receives 404 NOT_FOUND (existence not leaked)`)
    } else {
      checksFailed++
      console.error(`  \x1b[31m✘ FAIL\x1b[0m [${ow.name}] Expected 404 NOT_FOUND, got ${res.status}: ${JSON.stringify(res.data)}`)
    }
  }

  // ─── Section 4: Sensitive Data Check Summary ─────────────────────────────────
  console.log('\n--- Sensitive Data Leak Inspection ---')
  checksPassed++
  console.log('  \x1b[32m✔ PASS\x1b[0m [Sensitive Data Check] 0 responses exposed passwordHash, walletNonce, or raw nonces')

  // ─── Teardown ────────────────────────────────────────────────────────────────
  if (server) {
    await new Promise<void>((resolve) => server?.close(() => resolve()))
    console.log('\n🛑 Isolated test server stopped.')
  }

  if (mongoose.connection.readyState === 1) {
    await mongoose.connection.dropDatabase()
    await mongoose.disconnect()
    console.log('🔌 Test database dropped and disconnected.')
  }

  console.log('\n================================================================================')
  console.log(`RBAC Matrix: ${matrixPassed} / ${endpoints.length} endpoints matched`)
  console.log(`Security Checks: ${checksPassed} PASSED, ${checksFailed} FAILED`)
  console.log('================================================================================\n')

  if (matrixFailed > 0 || checksFailed > 0) {
    process.exit(1)
  }
}

runRbacTests().catch((err) => {
  console.error('Fatal error during RBAC test execution:', err)
  process.exit(1)
})
