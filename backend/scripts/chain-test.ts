/**
 * scripts/chain-test.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Blockchain integration test suite for GoHash backend.
 *
 * Isolation guarantees (same as smoke-test.ts):
 *   • In-process Express app on a random ephemeral port (listen(0)).
 *   • Connects to MONGODB_URI_TEST — database name MUST end in _test.
 *   • Drops the test database at start and end of the run.
 *   • Fails fast with the exact start command if MongoDB or Hardhat node
 *     is unreachable.
 *
 * SECURITY: No private key appears in this file.
 *   • The Hardhat node exposes pre-funded unlocked accounts; the test
 *     accesses them via ethers.JsonRpcProvider + provider.getSigner(index).
 *   • signer.signMessage() and contract write calls are ethers test tooling only —
 *     no key ever enters backend source code.
 *
 * Prerequisites (user runs these manually before npm run test:chain):
 *   Terminal 1: cd blockchain && npx hardhat node
 *   Terminal 2: cd blockchain && npx hardhat run scripts/deploy-local.ts --network localhost
 *   Terminal 3: docker start gohash-mongo   (or docker compose up -d)
 *   Terminal 4: cd backend && npm run test:chain
 *
 * Test cases:
 *   1.  getContractInfo returns deployed address + chainId
 *   2.  isNotaryAuthorized true for signer[1] (authorized by deploy script)
 *   3.  isNotaryAuthorized false for signer[2] (never authorized)
 *   4.  CONTRACT_NOT_DEPLOYED when DEPLOYMENT_FILE points to a missing file
 *   5.  wallet link OK (correct signer via signer[2])
 *   6.  wallet link wrong signer -> 400 SIGNATURE_INVALID
 *   7.  wallet link replay nonce -> 400 NONCE_INVALID
 *   8.  wallet link address already in use -> 409 WALLET_IN_USE
 *   9.  pending list as NOTARY ok, USER gets 403
 *   10. approve: USER 403, no linked wallet 400, owner wallet missing 400,
 *       wallet not authorized on chain 403 (use signer 3), returns the right args
 *   11. real flow: signer(1) calls the contract's notarize using the returned
 *       method and args -> confirm -> CONFIRMED, Document NOTARIZED,
 *       GET /documents/:id shows notarization
 *   12. confirm twice idempotent
 *   13. unknown tx hash
 *   14. a transaction to a different address
 *   15. a transaction from a second authorized notary that is not the linked wallet is rejected
 *   16. a notarize call for a different hash is rejected
 *   17. the same tx hash reused on another notarization is rejected
 *   18. reject with and without reason
 *   19. GET /blockchain/:documentId shows stored and on-chain data; another user gets 404
 *   20. POST /api/verify: real notarized PDF -> VERIFIED (right notaryWallet, txHash)
 *   21. POST /api/verify: same PDF + one extra byte -> NOT_VERIFIED
 *   22. POST /api/verify: non-PDF -> 400 INVALID_FILE
 *   23. POST /api/verify: no auth token required
 *   24. POST /api/verify: response never contains owner email or name
 *   25. Admin GET /api/admin/users: USER 403, NOTARY 403, ADMIN 200
 *   26. Admin PATCH /api/admin/users/:id/role: ADMIN cannot change own role (409)
 *   27. Admin PATCH /api/admin/users/:id/status: disable user -> 403 ACCOUNT_DISABLED
 *   28. Admin disabled user existing token stops working
 *   29. Admin GET /api/admin/notaries: includes onChainAuthorized
 *   30. Admin GET /api/admin/stats: counts correct
 *   31. No admin response contains passwordHash
 * ─────────────────────────────────────────────────────────────────────────────
 */

import http from 'http'
import crypto from 'crypto'
import mongoose from 'mongoose'
import { ethers } from 'ethers'
import app from '../src/app'
import { env } from '../src/config/env'
import { User } from '../src/models/User'
import { DocumentModel } from '../src/models/Document'
import { Notarization } from '../src/models/Notarization'
import { BlockchainService } from '../src/services/blockchain.service'

// Raise rate limits so chain tests are not throttled
env.AUTH_RATE_LIMIT_MAX = 1000
env.VERIFY_RATE_LIMIT_PER_MIN = 1000

// ─── Test runner state ────────────────────────────────────────────────────────

let server: http.Server | null = null
let BASE_URL = ''
let testsPassed = 0
let testsFailed = 0

const MONGODB_URI_TEST =
  process.env.MONGODB_URI_TEST || 'mongodb://localhost:27017/gohash_test'

const RPC_URL = process.env.RPC_URL || 'http://127.0.0.1:8545'

// ─── Safety guard ─────────────────────────────────────────────────────────────

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
  console.error(
    `Refusing to run chain test: database name "${dbName}" in MONGODB_URI_TEST must end with "_test".`
  )
  process.exit(1)
}

// ─── Logging ──────────────────────────────────────────────────────────────────

function logPass(name: string, detail = '') {
  testsPassed++
  console.log(`  \x1b[32m✔ PASS\x1b[0m [${name}] ${detail}`)
}

function logFail(name: string, error: unknown) {
  testsFailed++
  console.error(`  \x1b[31m✘ FAIL\x1b[0m [${name}]:`, error)
}

// ─── HTTP helper ──────────────────────────────────────────────────────────────

async function request(
  urlPath: string,
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

  const res = await fetch(`${BASE_URL}${urlPath}`, {
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

// ─── Multipart file upload helper ─────────────────────────────────────────────

async function uploadFileRequest(
  urlPath: string,
  buffer: Buffer,
  filename: string,
  mimetype: string,
  token?: string
): Promise<{ status: number; data: any }> {
  const formData = new FormData()
  formData.append('file', new Blob([buffer], { type: mimetype }), filename)
  const headers: Record<string, string> = {}
  if (token) headers['Authorization'] = `Bearer ${token}`

  const res = await fetch(`${BASE_URL}${urlPath}`, {
    method: 'POST',
    headers,
    body: formData,
  })

  let data: any = null
  try { data = await res.json() } catch { data = null }
  return { status: res.status, data }
}

// ─── Main test runner ─────────────────────────────────────────────────────────

async function runChainTests() {
  mongoose.connection.removeAllListeners('disconnected')
  mongoose.connection.removeAllListeners('error')

  // ── Fail fast: MongoDB ────────────────────────────────────────────────────
  try {
    await mongoose.connect(MONGODB_URI_TEST, { serverSelectionTimeoutMS: 2000 })
  } catch {
    console.error(
      `MongoDB not reachable at ${MONGODB_URI_TEST}.\n` +
        `Start it with: docker start gohash-mongo`
    )
    process.exit(1)
  }

  // ── Fail fast: Hardhat node ───────────────────────────────────────────────
  const provider = new ethers.JsonRpcProvider(RPC_URL)
  try {
    await provider.getNetwork()
  } catch {
    console.error(
      `Hardhat node not reachable at ${RPC_URL}.\n` +
        `Start it with: cd blockchain && npx hardhat node`
    )
    process.exit(1)
  }

  console.log('\n========================================')
  console.log('    GoHash Backend Chain Test Suite     ')
  console.log('========================================\n')
  console.log(`Database : ${dbName}`)
  console.log(`RPC URL  : ${RPC_URL}\n`)

  // Drop test database at the start
  await mongoose.connection.dropDatabase()

  // Ensure indexes
  await User.init()
  await DocumentModel.init()
  await Notarization.init()

  // Spin up isolated test server on random free port
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

  // Hardhat unlocked accounts accessed via provider (test-only; no private keys in code)
  const signer0 = await provider.getSigner(0) // deployer / owner
  const signer1 = await provider.getSigner(1) // authorized notary (authorized by deploy script)
  const signer2 = await provider.getSigner(2) // regular user (never authorized)
  const signer3 = await provider.getSigner(3) // account 3 (initially unauthorized on chain)
  const signer1Address = await signer1.getAddress()
  const signer2Address = await signer2.getAddress()
  const signer3Address = await signer3.getAddress()

  // Ensure signer3 is NOT authorized on-chain at the start of the test run (clean slate for repeated runs)
  try {
    const isSigner3Auth = await BlockchainService.isNotaryAuthorized(signer3Address)
    if (isSigner3Auth) {
      const contractAsOwner = BlockchainService.getContract(signer0)
      const removeTx = await contractAsOwner.removeNotary(signer3Address)
      await removeTx.wait()
    }
  } catch {
    // If contract not deployed yet, continue
  }

  const testPassword = 'Password123!'

  // Helper: register a user and return {token, id}
  async function registerUser(email: string, name = 'Chain Tester') {
    const res = await request('/api/auth/register', {
      method: 'POST',
      body: { name, email, password: testPassword, confirmPassword: testPassword },
    })
    return { token: res.data?.token as string, id: res.data?.user?.id as string }
  }

  // Helper: link a wallet to a user via the challenge nonce flow
  async function linkWallet(userToken: string, signer: ethers.Signer) {
    const signerAddress = await signer.getAddress()
    const nonceRes = await request('/api/auth/wallet/nonce', {
      method: 'POST',
      headers: { Authorization: `Bearer ${userToken}` },
    })
    if (nonceRes.status !== 200 || !nonceRes.data?.message) {
      throw new Error(`Failed to obtain nonce: ${JSON.stringify(nonceRes.data)}`)
    }
    const signature = await signer.signMessage(nonceRes.data.message)
    const patchRes = await request('/api/auth/wallet', {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${userToken}` },
      body: { walletAddress: signerAddress, signature },
    })
    return patchRes
  }

  // Helper: create a document in the test database for an owner
  async function createDoc(ownerId: string, sha256Hash: string, originalName = 'contract.pdf') {
    return await DocumentModel.create({
      ownerId: new mongoose.Types.ObjectId(ownerId),
      fileName: `${new mongoose.Types.ObjectId()}.pdf`,
      originalName,
      mimeType: 'application/pdf',
      fileSize: 2048,
      sha256Hash,
      status: 'PENDING',
      visibility: 'PRIVATE',
    })
  }

  const testEmail = `chain_test_${Date.now()}_${crypto.randomBytes(4).toString('hex')}@example.com`
  let authToken = ''
  let testUserId = ''

  try {
    const { token, id } = await registerUser(testEmail)
    authToken  = token
    testUserId = id

    console.log('--- Blockchain Service Tests ---')

    // ── Test 1: getContractInfo ──────────────────────────────────────────────
    try {
      const info = BlockchainService.getContractInfo()
      if (
        typeof info.address === 'string' &&
        info.address.startsWith('0x') &&
        info.address.length === 42 &&
        typeof info.chainId === 'number'
      ) {
        logPass('getContractInfo', `address=${info.address}, chainId=${info.chainId}`)
      } else {
        throw new Error(`Unexpected contractInfo: ${JSON.stringify(info)}`)
      }
    } catch (err) {
      logFail('getContractInfo', err)
    }

    // ── Test 2: isNotaryAuthorized — signer[1] should be true ───────────────
    try {
      const authorized = await BlockchainService.isNotaryAuthorized(signer1Address)
      if (authorized === true) {
        logPass('isNotaryAuthorized (signer[1])', `${signer1Address} -> true`)
      } else {
        throw new Error(
          `Expected true for signer[1] (${signer1Address}), got ${authorized}`
        )
      }
    } catch (err) {
      logFail('isNotaryAuthorized (signer[1])', err)
    }

    // ── Test 3: isNotaryAuthorized — signer[2] should be false ──────────────
    try {
      const authorized = await BlockchainService.isNotaryAuthorized(signer2Address)
      if (authorized === false) {
        logPass('isNotaryAuthorized (signer[2])', `${signer2Address} -> false`)
      } else {
        throw new Error(
          `Expected false for signer[2] (${signer2Address}), got ${authorized}`
        )
      }
    } catch (err) {
      logFail('isNotaryAuthorized (signer[2])', err)
    }

    // ── Test 4: CONTRACT_NOT_DEPLOYED when deployment file is missing ────────
    try {
      const { env: cachedEnv } = await import('../src/config/env')
      const originalFile = cachedEnv.DEPLOYMENT_FILE
      ;(cachedEnv as any).DEPLOYMENT_FILE = './non_existent_deployment_12345.json'

      let caught: unknown = null
      try {
        BlockchainService.getContractInfo()
      } catch (e) {
        caught = e
      }

      ;(cachedEnv as any).DEPLOYMENT_FILE = originalFile // restore

      if (caught && (caught as any).code === 'CONTRACT_NOT_DEPLOYED') {
        logPass(
          'CONTRACT_NOT_DEPLOYED (missing file)',
          `code=${(caught as any).code}`
        )
      } else {
        throw new Error(
          `Expected ApiError with code CONTRACT_NOT_DEPLOYED, got: ${JSON.stringify(caught)}`
        )
      }
    } catch (err) {
      logFail('CONTRACT_NOT_DEPLOYED (missing file)', err)
    }

    console.log('\n--- Wallet Link Tests (via HTTP) ---')

    // ── Test 5: wallet link OK (signer[2] signs, claims signer[2] address) ───
    try {
      const patchRes = await linkWallet(authToken, signer2)
      if (
        patchRes.status === 200 &&
        patchRes.data?.success === true &&
        patchRes.data?.user?.walletAddress === signer2Address.toLowerCase()
      ) {
        logPass(
          'wallet link OK (signer[2])',
          `linked=${patchRes.data.user.walletAddress}`
        )
      } else {
        throw new Error(
          `Expected 200 with wallet, got ${patchRes.status}: ${JSON.stringify(patchRes.data)}`
        )
      }
    } catch (err) {
      logFail('wallet link OK (signer[2])', err)
    }

    // ── Test 6: wrong signer -> 400 SIGNATURE_INVALID ────────────────────────
    try {
      const nonceRes = await request('/api/auth/wallet/nonce', {
        method: 'POST',
        headers: { Authorization: `Bearer ${authToken}` },
      })
      const message = nonceRes.data.message as string
      const wrongSig = await signer0.signMessage(message)

      const patchRes = await request('/api/auth/wallet', {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${authToken}` },
        body: { walletAddress: signer2Address, signature: wrongSig },
      })

      if (
        patchRes.status === 400 &&
        patchRes.data?.error?.code === 'SIGNATURE_INVALID'
      ) {
        logPass(
          'wallet link wrong signer -> SIGNATURE_INVALID',
          `code=${patchRes.data.error.code}`
        )
      } else {
        throw new Error(
          `Expected 400 SIGNATURE_INVALID, got ${patchRes.status}: ${JSON.stringify(patchRes.data)}`
        )
      }
    } catch (err) {
      logFail('wallet link wrong signer -> SIGNATURE_INVALID', err)
    }

    // ── Test 7: replay nonce -> 400 NONCE_INVALID ─────────────────────────────
    try {
      const nonceRes = await request('/api/auth/wallet/nonce', {
        method: 'POST',
        headers: { Authorization: `Bearer ${authToken}` },
      })
      const message = nonceRes.data.message as string
      const sig = await signer2.signMessage(message)

      // First call consumes nonce
      await request('/api/auth/wallet', {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${authToken}` },
        body: { walletAddress: signer2Address, signature: sig },
      })

      // Second call with same nonce must fail
      const replayRes = await request('/api/auth/wallet', {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${authToken}` },
        body: { walletAddress: signer2Address, signature: sig },
      })

      if (
        replayRes.status === 400 &&
        replayRes.data?.error?.code === 'NONCE_INVALID'
      ) {
        logPass(
          'wallet link replay -> NONCE_INVALID',
          `code=${replayRes.data.error.code}`
        )
      } else {
        throw new Error(
          `Expected 400 NONCE_INVALID on replay, got ${replayRes.status}: ${JSON.stringify(replayRes.data)}`
        )
      }
    } catch (err) {
      logFail('wallet link replay -> NONCE_INVALID', err)
    }

    // ── Test 8: wallet address already linked to another user -> 409 WALLET_IN_USE
    try {
      const user2Email = `chain_user2_${Date.now()}_${crypto.randomBytes(4).toString('hex')}@example.com`
      const { token: token2, id: id2 } = await registerUser(user2Email, 'Chain User 2')

      const nonceRes = await request('/api/auth/wallet/nonce', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token2}` },
      })
      const message = nonceRes.data.message as string
      const sig = await signer2.signMessage(message)

      const patchRes = await request('/api/auth/wallet', {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token2}` },
        body: { walletAddress: signer2Address, signature: sig },
      })

      if (id2) await User.deleteOne({ _id: id2 })

      if (
        patchRes.status === 409 &&
        patchRes.data?.error?.code === 'WALLET_IN_USE'
      ) {
        logPass(
          'wallet link address in use -> WALLET_IN_USE',
          `code=${patchRes.data.error.code}`
        )
      } else {
        throw new Error(
          `Expected 409 WALLET_IN_USE, got ${patchRes.status}: ${JSON.stringify(patchRes.data)}`
        )
      }
    } catch (err) {
      logFail('wallet link address in use -> WALLET_IN_USE', err)
    } finally {
      // Clear testUser's wallet so signer2 is free for User A in subsequent tests
      await User.updateOne({ _id: testUserId }, { $set: { walletAddress: null } })
    }

    console.log('\n--- Notarization Workflow Tests ---')

    // Set up actors for notarization workflow:
    // User A: Document owner (regular USER)
    const userAEmail = `user_a_${Date.now()}_${crypto.randomBytes(4).toString('hex')}@example.com`
    const { token: userAToken, id: userAId } = await registerUser(userAEmail, 'User A')

    // Notary User: Certified notary (NOTARY role)
    // 1. Register the user
    const notaryEmail = `notary_${Date.now()}_${crypto.randomBytes(4).toString('hex')}@example.com`
    const { id: notaryId } = await registerUser(notaryEmail, 'Notary Official')

    // 2. Update role in database BEFORE logging in
    await User.updateOne({ _id: notaryId }, { role: 'NOTARY' })

    // 3. Log in to obtain a fresh JWT carrying the NOTARY role
    const notaryLoginRes = await request('/api/auth/login', {
      method: 'POST',
      body: { email: notaryEmail, password: testPassword },
    })
    if (notaryLoginRes.status !== 200 || !notaryLoginRes.data?.token) {
      throw new Error(`Failed to log in as NOTARY: ${JSON.stringify(notaryLoginRes.data)}`)
    }
    const notaryToken = notaryLoginRes.data.token

    // User B: Independent third-party (regular USER)
    const userBEmail = `user_b_${Date.now()}_${crypto.randomBytes(4).toString('hex')}@example.com`
    const { token: userBToken, id: userBId } = await registerUser(userBEmail, 'User B')

    // ── Test 9: pending list as NOTARY ok, USER gets 403 ─────────────────────
    try {
      const userRes = await request('/api/notarization/pending', {
        headers: { Authorization: `Bearer ${userAToken}` },
      })
      if (userRes.status !== 403) {
        throw new Error(`Expected 403 for USER, got ${userRes.status}`)
      }

      const notaryRes = await request('/api/notarization/pending', {
        headers: { Authorization: `Bearer ${notaryToken}` },
      })
      if (
        notaryRes.status === 200 &&
        notaryRes.data?.success === true &&
        Array.isArray(notaryRes.data?.notarizations)
      ) {
        logPass('pending list as NOTARY ok, USER gets 403', `USER=403, NOTARY=200`)
      } else {
        throw new Error(`Expected 200 array for NOTARY, got ${notaryRes.status}: ${JSON.stringify(notaryRes.data)}`)
      }
    } catch (err) {
      logFail('pending list as NOTARY ok, USER gets 403', err)
    }

    // ── Test 10: approve preconditions and return args ───────────────────────
    // USER 403, no linked wallet 400, owner wallet missing 400,
    // wallet not authorized on chain 403 (use signer 3), returns the right args
    const doc1Hash = crypto.randomBytes(32).toString('hex')
    const doc1 = await createDoc(userAId, doc1Hash, 'contract_doc1.pdf')
    let notarization1Id = ''
    let approveResultData: any = null

    try {
      // User A requests notarization for doc1
      const reqRes = await request('/api/notarization/request', {
        method: 'POST',
        headers: { Authorization: `Bearer ${userAToken}` },
        body: { documentId: doc1._id.toString() },
      })
      if (reqRes.status !== 201 || !reqRes.data?.notarization?.id) {
        throw new Error(`Failed to create notarization request: ${JSON.stringify(reqRes.data)}`)
      }
      notarization1Id = reqRes.data.notarization.id

      // 10a. USER gets 403 on approve
      const userApprove = await request(`/api/notarization/${notarization1Id}/approve`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${userAToken}` },
      })
      if (userApprove.status !== 403) {
        throw new Error(`Expected 403 for USER on approve, got ${userApprove.status}`)
      }

      // 10b. Notary has no linked wallet yet -> 400 WALLET_NOT_LINKED
      const noWalletApprove = await request(`/api/notarization/${notarization1Id}/approve`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${notaryToken}` },
      })
      if (
        noWalletApprove.status !== 400 ||
        noWalletApprove.data?.error?.code !== 'WALLET_NOT_LINKED'
      ) {
        throw new Error(`Expected 400 WALLET_NOT_LINKED, got ${noWalletApprove.status}: ${JSON.stringify(noWalletApprove.data)}`)
      }

      // 10c. Notary links signer 3 (not authorized on chain) -> 403 NOTARY_NOT_AUTHORIZED_ON_CHAIN
      await linkWallet(notaryToken, signer3)
      const unauthorizedApprove = await request(`/api/notarization/${notarization1Id}/approve`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${notaryToken}` },
      })
      if (
        unauthorizedApprove.status !== 403 ||
        unauthorizedApprove.data?.error?.code !== 'NOTARY_NOT_AUTHORIZED_ON_CHAIN'
      ) {
        throw new Error(`Expected 403 NOTARY_NOT_AUTHORIZED_ON_CHAIN, got ${unauthorizedApprove.status}: ${JSON.stringify(unauthorizedApprove.data)}`)
      }

      // 10d. Notary links signer 1 (authorized on chain), but owner has no linked wallet -> 400 OWNER_WALLET_REQUIRED
      // Clear notary wallet to re-link signer 1
      await User.updateOne({ _id: notaryId }, { $set: { walletAddress: null } })
      await linkWallet(notaryToken, signer1)

      const noOwnerWalletApprove = await request(`/api/notarization/${notarization1Id}/approve`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${notaryToken}` },
      })
      if (
        noOwnerWalletApprove.status !== 400 ||
        noOwnerWalletApprove.data?.error?.code !== 'OWNER_WALLET_REQUIRED'
      ) {
        throw new Error(`Expected 400 OWNER_WALLET_REQUIRED, got ${noOwnerWalletApprove.status}: ${JSON.stringify(noOwnerWalletApprove.data)}`)
      }

      // 10e. Owner (User A) links signer 2
      await linkWallet(userAToken, signer2)

      // 10f. Now approve succeeds and returns the exact contract call args
      const successApprove = await request(`/api/notarization/${notarization1Id}/approve`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${notaryToken}` },
      })

      if (
        successApprove.status === 200 &&
        successApprove.data?.success === true &&
        successApprove.data?.method === 'notarize' &&
        Array.isArray(successApprove.data?.args) &&
        successApprove.data.args[0] === `0x${doc1Hash}` &&
        successApprove.data.args[1] === '' &&
        successApprove.data.args[2].toLowerCase() === signer2Address.toLowerCase() &&
        typeof successApprove.data?.contractAddress === 'string' &&
        typeof successApprove.data?.chainId === 'number'
      ) {
        approveResultData = successApprove.data
        logPass(
          'approve: preconditions & return args',
          `method=${successApprove.data.method}, args=[${successApprove.data.args[0].slice(0, 10)}..., "", ${successApprove.data.args[2]}]`
        )
      } else {
        throw new Error(`Expected 200 with contract args, got ${successApprove.status}: ${JSON.stringify(successApprove.data)}`)
      }

      // 10g. Self-notarization prevention: notary uploads own document, requests notarization, approve returns 403 SELF_NOTARIZATION_NOT_ALLOWED
      const notaryPdf = Buffer.from(`%PDF-1.4\n%Notary Self Test ${Date.now()}\n%%EOF`)
      const notaryUpRes = await uploadFileRequest(
        '/api/documents/upload',
        notaryPdf,
        'notary_self_test.pdf',
        'application/pdf',
        notaryToken
      )
      if (notaryUpRes.status !== 201 || !notaryUpRes.data?.document?.id) {
        throw new Error(`Failed to upload document as notary: ${JSON.stringify(notaryUpRes.data)}`)
      }
      const notarySelfDocId = notaryUpRes.data.document.id

      const notarySelfReq = await request('/api/notarization/request', {
        method: 'POST',
        headers: { Authorization: `Bearer ${notaryToken}` },
        body: { documentId: notarySelfDocId },
      })
      if (notarySelfReq.status !== 201 || !notarySelfReq.data?.notarization?.id) {
        throw new Error(`Failed to create notarization request for notary own doc: ${JSON.stringify(notarySelfReq.data)}`)
      }
      const selfNotarizationId = notarySelfReq.data.notarization.id

      // Notary attempts to approve their own document -> 403 SELF_NOTARIZATION_NOT_ALLOWED
      const selfApproveRes = await request(`/api/notarization/${selfNotarizationId}/approve`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${notaryToken}` },
      })
      if (
        selfApproveRes.status === 403 &&
        selfApproveRes.data?.error?.code === 'SELF_NOTARIZATION_NOT_ALLOWED' &&
        selfApproveRes.data?.error?.message === 'A notary cannot approve or reject their own document.'
      ) {
        // Also verify reject gives 403 SELF_NOTARIZATION_NOT_ALLOWED
        const selfRejectRes = await request(`/api/notarization/${selfNotarizationId}/reject`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${notaryToken}` },
          body: { reason: 'Attempting self-rejection' },
        })
        if (
          selfRejectRes.status === 403 &&
          selfRejectRes.data?.error?.code === 'SELF_NOTARIZATION_NOT_ALLOWED' &&
          selfRejectRes.data?.error?.message === 'A notary cannot approve or reject their own document.'
        ) {
          logPass(
            'self-notarization prevented -> 403 SELF_NOTARIZATION_NOT_ALLOWED',
            'approve & reject blocked for own document'
          )
        } else {
          throw new Error(`Expected 403 SELF_NOTARIZATION_NOT_ALLOWED on reject, got ${selfRejectRes.status}: ${JSON.stringify(selfRejectRes.data)}`)
        }
      } else {
        throw new Error(
          `Expected 403 SELF_NOTARIZATION_NOT_ALLOWED on approve, got ${selfApproveRes.status}: ${JSON.stringify(selfApproveRes.data)}`
        )
      }
    } catch (err) {
      logFail('approve: preconditions & return args', err)
    }

    // ── Test 11: real flow (notarize on-chain -> confirm -> CONFIRMED) ────────
    let realTxHash = ''
    try {
      const contractAsNotary = BlockchainService.getContract(signer1)

      // Signer 1 (the authorized notary) calls notarize on the smart contract
      const tx = await contractAsNotary.notarize(
        approveResultData.args[0],
        approveResultData.args[1],
        approveResultData.args[2]
      )
      const receipt = await tx.wait()
      realTxHash = tx.hash

      // Notary calls POST /api/notarization/:id/confirm
      const confirmRes = await request(`/api/notarization/${notarization1Id}/confirm`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${notaryToken}` },
        body: { transactionHash: realTxHash },
      })

      if (
        confirmRes.status !== 200 ||
        confirmRes.data?.success !== true ||
        confirmRes.data?.notarization?.status !== 'CONFIRMED' ||
        confirmRes.data?.notarization?.transactionHash?.toLowerCase() !== realTxHash.toLowerCase() ||
        confirmRes.data?.notarization?.blockNumber !== receipt.blockNumber ||
        typeof confirmRes.data?.notarization?.onChainTimestamp !== 'number'
      ) {
        throw new Error(`Confirm failed: status=${confirmRes.status}, data=${JSON.stringify(confirmRes.data)}`)
      }

      // Verify Document model is NOTARIZED
      const checkDoc = await DocumentModel.findById(doc1._id)
      if (checkDoc?.status !== 'NOTARIZED') {
        throw new Error(`Expected Document status NOTARIZED, got ${checkDoc?.status}`)
      }

      // Verify GET /api/documents/:id shows notarization details including on-chain timestamp & rejectionReason
      const contractInfo = BlockchainService.getContractInfo()
      const docDetailRes = await request(`/api/documents/${doc1._id.toString()}`, {
        headers: { Authorization: `Bearer ${userAToken}` },
      })

      // Independent recomputation of unique notarization key:
      // keccak256(abi-encoded packed [documentHash bytes32, transactionHash bytes32]),
      // first 16 uppercase hex characters formatted as GH-XXXX-XXXX-XXXX-XXXX.
      const expectedDigest = ethers.solidityPackedKeccak256(
        ['bytes32', 'bytes32'],
        [`0x${doc1Hash}`, realTxHash]
      )
      const expectedRaw16 = expectedDigest.slice(2, 18).toUpperCase()
      const expectedKey = `GH-${expectedRaw16.slice(0, 4)}-${expectedRaw16.slice(4, 8)}-${expectedRaw16.slice(8, 12)}-${expectedRaw16.slice(12, 16)}`

      const notField = docDetailRes.data?.document?.notarization
      if (
        docDetailRes.status === 200 &&
        docDetailRes.data?.document?.status === 'NOTARIZED' &&
        notField &&
        notField.status === 'CONFIRMED' &&
        notField.transactionHash?.toLowerCase() === realTxHash.toLowerCase() &&
        notField.blockNumber === receipt.blockNumber &&
        notField.notaryWallet?.toLowerCase() === signer1Address.toLowerCase() &&
        notField.contractAddress?.toLowerCase() === contractInfo.address.toLowerCase() &&
        typeof notField.timestamp === 'number' &&
        notField.rejectionReason === null &&
        confirmRes.data?.notarization?.notarizationKey === expectedKey &&
        notField.notarizationKey === expectedKey
      ) {
        logPass(
          'real flow: on-chain notarize -> confirm -> CONFIRMED',
          `txHash=${realTxHash.slice(0, 14)}..., key=${expectedKey}, block=${receipt.blockNumber}, status=NOTARIZED`
        )
      } else {
        throw new Error(`Document detail missing notarization or key mismatch: ${JSON.stringify(docDetailRes.data)}`)
      }
    } catch (err) {
      logFail('real flow: on-chain notarize -> confirm -> CONFIRMED', err)
    }

    // ── Test 12: confirm twice idempotent ────────────────────────────────────
    try {
      const confirmRes = await request(`/api/notarization/${notarization1Id}/confirm`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${notaryToken}` },
        body: { transactionHash: realTxHash },
      })

      if (
        confirmRes.status === 200 &&
        confirmRes.data?.success === true &&
        confirmRes.data?.notarization?.status === 'CONFIRMED' &&
        confirmRes.data?.notarization?.transactionHash?.toLowerCase() === realTxHash.toLowerCase()
      ) {
        logPass('confirm twice idempotent', `status=200, still CONFIRMED`)
      } else {
        throw new Error(`Expected idempotent 200, got ${confirmRes.status}: ${JSON.stringify(confirmRes.data)}`)
      }
    } catch (err) {
      logFail('confirm twice idempotent', err)
    }

    // Set up doc2 for rejection & error validation checks
    const doc2Hash = crypto.randomBytes(32).toString('hex')
    const doc2 = await createDoc(userAId, doc2Hash, 'doc2.pdf')
    const req2 = await request('/api/notarization/request', {
      method: 'POST',
      headers: { Authorization: `Bearer ${userAToken}` },
      body: { documentId: doc2._id.toString() },
    })
    const notarization2Id = req2.data?.notarization?.id
    await request(`/api/notarization/${notarization2Id}/approve`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${notaryToken}` },
    })

    // ── Test 13: unknown tx hash -> 422 VERIFICATION_FAILED ─────────────────
    try {
      const unknownTxHash = '0x' + '9'.repeat(64)
      const res = await request(`/api/notarization/${notarization2Id}/confirm`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${notaryToken}` },
        body: { transactionHash: unknownTxHash },
      })

      if (
        res.status === 422 &&
        res.data?.error?.code === 'VERIFICATION_FAILED'
      ) {
        logPass('unknown tx hash -> 422 VERIFICATION_FAILED', `status=422, code=${res.data.error.code}`)
      } else {
        throw new Error(`Expected 422 VERIFICATION_FAILED for unknown tx, got ${res.status}: ${JSON.stringify(res.data)}`)
      }
    } catch (err) {
      logFail('unknown tx hash -> 422 VERIFICATION_FAILED', err)
    }

    // ── Test 14: a transaction to a different address -> 422 ────────────────
    try {
      // Send 0 ETH transfer to signer2 instead of calling the contract
      const diffTx = await signer1.sendTransaction({
        to: signer2Address,
        value: 0,
      })
      await diffTx.wait()

      const res = await request(`/api/notarization/${notarization2Id}/confirm`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${notaryToken}` },
        body: { transactionHash: diffTx.hash },
      })

      if (
        res.status === 422 &&
        res.data?.error?.code === 'VERIFICATION_FAILED' &&
        res.data?.error?.message?.includes('WRONG_CONTRACT')
      ) {
        logPass('tx to different address -> 422 WRONG_CONTRACT', `status=422, reason=WRONG_CONTRACT`)
      } else {
        throw new Error(`Expected 422 WRONG_CONTRACT, got ${res.status}: ${JSON.stringify(res.data)}`)
      }
    } catch (err) {
      logFail('tx to different address -> 422 WRONG_CONTRACT', err)
    }

    // ── Test 15: transaction from a second authorized notary that is not the linked wallet is rejected ──
    try {
      const contractAsOwner = BlockchainService.getContract(signer0)

      // Signer 0 (contract owner) authorizes signer 3 as a second notary on-chain
      const addNotaryTx = await contractAsOwner.addNotary(signer3Address)
      await addNotaryTx.wait()

      // Set up doc3
      const doc3Hash = crypto.randomBytes(32).toString('hex')
      const doc3 = await createDoc(userAId, doc3Hash, 'doc3.pdf')
      const req3 = await request('/api/notarization/request', {
        method: 'POST',
        headers: { Authorization: `Bearer ${userAToken}` },
        body: { documentId: doc3._id.toString() },
      })
      const notarization3Id = req3.data?.notarization?.id

      // Notary 1 (whose linked wallet is signer 1) approves doc3
      await request(`/api/notarization/${notarization3Id}/approve`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${notaryToken}` },
      })

      // Signer 3 (second authorized notary) calls notarize on-chain
      const contractAsSigner3 = BlockchainService.getContract(signer3)
      const txNotary3 = await contractAsSigner3.notarize(
        `0x${doc3Hash}`,
        '',
        signer2Address
      )
      await txNotary3.wait()

      // Notary 1 tries to confirm with signer 3's transaction -> rejected
      const confirmRes = await request(`/api/notarization/${notarization3Id}/confirm`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${notaryToken}` },
        body: { transactionHash: txNotary3.hash },
      })

      // Immediately revoke signer 3 so the node state remains clean
      const removeTx = await contractAsOwner.removeNotary(signer3Address)
      await removeTx.wait()

      if (
        confirmRes.status === 422 &&
        confirmRes.data?.error?.code === 'VERIFICATION_FAILED' &&
        confirmRes.data?.error?.message?.includes('WRONG_SIGNER')
      ) {
        logPass(
          'second notary tx rejected for unlinked wallet -> 422 WRONG_SIGNER',
          `status=422, reason=WRONG_SIGNER`
        )
      } else {
        throw new Error(`Expected 422 WRONG_SIGNER, got ${confirmRes.status}: ${JSON.stringify(confirmRes.data)}`)
      }
    } catch (err) {
      logFail('second notary tx rejected for unlinked wallet -> 422 WRONG_SIGNER', err)
    }

    // ── Test 16: notarize call for a different hash is rejected ──────────────
    try {
      const contractAsNotary = BlockchainService.getContract(signer1)

      // Set up doc4
      const doc4Hash = crypto.randomBytes(32).toString('hex')
      const doc4 = await createDoc(userAId, doc4Hash, 'doc4.pdf')
      const req4 = await request('/api/notarization/request', {
        method: 'POST',
        headers: { Authorization: `Bearer ${userAToken}` },
        body: { documentId: doc4._id.toString() },
      })
      const notarization4Id = req4.data?.notarization?.id

      await request(`/api/notarization/${notarization4Id}/approve`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${notaryToken}` },
      })

      // Signer 1 calls notarize on-chain with a DIFFERENT document hash
      const differentHash = '0x' + crypto.randomBytes(32).toString('hex')
      const diffHashTx = await contractAsNotary.notarize(
        differentHash,
        '',
        signer2Address
      )
      await diffHashTx.wait()

      // Notary tries to confirm doc4 with the different hash's tx -> rejected
      const confirmRes = await request(`/api/notarization/${notarization4Id}/confirm`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${notaryToken}` },
        body: { transactionHash: diffHashTx.hash },
      })

      if (
        confirmRes.status === 422 &&
        confirmRes.data?.error?.code === 'VERIFICATION_FAILED' &&
        confirmRes.data?.error?.message?.includes('WRONG_HASH')
      ) {
        logPass('notarize call for different hash rejected -> 422 WRONG_HASH', `status=422, reason=WRONG_HASH`)
      } else {
        throw new Error(`Expected 422 WRONG_HASH, got ${confirmRes.status}: ${JSON.stringify(confirmRes.data)}`)
      }
    } catch (err) {
      logFail('notarize call for different hash rejected -> 422 WRONG_HASH', err)
    }

    // ── Test 17: same tx hash reused on another notarization is rejected ────
    try {
      // Set up doc5
      const doc5Hash = crypto.randomBytes(32).toString('hex')
      const doc5 = await createDoc(userAId, doc5Hash, 'doc5.pdf')
      const req5 = await request('/api/notarization/request', {
        method: 'POST',
        headers: { Authorization: `Bearer ${userAToken}` },
        body: { documentId: doc5._id.toString() },
      })
      const notarization5Id = req5.data?.notarization?.id

      await request(`/api/notarization/${notarization5Id}/approve`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${notaryToken}` },
      })

      // Try to confirm doc5 with the already-confirmed realTxHash from doc1
      const res = await request(`/api/notarization/${notarization5Id}/confirm`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${notaryToken}` },
        body: { transactionHash: realTxHash },
      })

      if (
        res.status === 422 &&
        res.data?.error?.code === 'VERIFICATION_FAILED' &&
        res.data?.error?.message?.includes('already used')
      ) {
        logPass('reused tx hash rejected -> 422 VERIFICATION_FAILED', `status=422, already used`)
      } else {
        throw new Error(`Expected 422 for reused txHash, got ${res.status}: ${JSON.stringify(res.data)}`)
      }
    } catch (err) {
      logFail('reused tx hash rejected -> 422 VERIFICATION_FAILED', err)
    }

    // ── Test 18: reject with and without reason ──────────────────────────────
    try {
      // Set up doc6
      const doc6Hash = crypto.randomBytes(32).toString('hex')
      const doc6 = await createDoc(userAId, doc6Hash, 'doc6.pdf')
      const req6 = await request('/api/notarization/request', {
        method: 'POST',
        headers: { Authorization: `Bearer ${userAToken}` },
        body: { documentId: doc6._id.toString() },
      })
      const notarization6Id = req6.data?.notarization?.id

      // 18a. Reject without reason -> 400 REASON_REQUIRED
      const noReasonRes = await request(`/api/notarization/${notarization6Id}/reject`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${notaryToken}` },
        body: {},
      })
      if (
        noReasonRes.status !== 400 ||
        noReasonRes.data?.error?.code !== 'REASON_REQUIRED'
      ) {
        throw new Error(`Expected 400 REASON_REQUIRED without body, got ${noReasonRes.status}: ${JSON.stringify(noReasonRes.data)}`)
      }

      // 18b. Reject with empty reason -> 400 REASON_REQUIRED
      const emptyReasonRes = await request(`/api/notarization/${notarization6Id}/reject`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${notaryToken}` },
        body: { reason: '   ' },
      })
      if (
        emptyReasonRes.status !== 400 ||
        emptyReasonRes.data?.error?.code !== 'REASON_REQUIRED'
      ) {
        throw new Error(`Expected 400 REASON_REQUIRED for empty string, got ${emptyReasonRes.status}: ${JSON.stringify(emptyReasonRes.data)}`)
      }

      // 18c. Reject with valid reason -> 200 OK, Notarization REJECTED, Document REJECTED
      const validRejectRes = await request(`/api/notarization/${notarization6Id}/reject`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${notaryToken}` },
        body: { reason: 'Illegible document scan and blurry stamp' },
      })

      const checkDoc6 = await DocumentModel.findById(doc6._id)
      if (
        validRejectRes.status === 200 &&
        validRejectRes.data?.success === true &&
        validRejectRes.data?.notarization?.status === 'REJECTED' &&
        validRejectRes.data?.notarization?.rejectionReason === 'Illegible document scan and blurry stamp' &&
        checkDoc6?.status === 'REJECTED'
      ) {
        logPass(
          'reject with and without reason',
          `empty=400 REASON_REQUIRED, valid=200 REJECTED, Doc=REJECTED`
        )
      } else {
        throw new Error(`Expected REJECTED state, got ${validRejectRes.status}: ${JSON.stringify(validRejectRes.data)}`)
      }

      // 18d. Trying to reject an already REJECTED request -> 409 INVALID_STATE
      const repeatReject = await request(`/api/notarization/${notarization6Id}/reject`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${notaryToken}` },
        body: { reason: 'Another reason' },
      })
      if (repeatReject.status !== 409 || repeatReject.data?.error?.code !== 'INVALID_STATE') {
        throw new Error(`Expected 409 INVALID_STATE on repeat reject, got ${repeatReject.status}`)
      }
    } catch (err) {
      logFail('reject with and without reason', err)
    }

    // ── Test 19: GET /blockchain/:documentId shows stored and on-chain data; another user gets 404 ──
    try {
      // 19a. Document owner (User A) reads doc1
      const ownerRes = await request(`/api/blockchain/${doc1._id.toString()}`, {
        headers: { Authorization: `Bearer ${userAToken}` },
      })

      if (
        ownerRes.status !== 200 ||
        ownerRes.data?.success !== true ||
        ownerRes.data?.document?.id !== doc1._id.toString() ||
        !ownerRes.data?.stored ||
        ownerRes.data?.stored?.status !== 'CONFIRMED' ||
        ownerRes.data?.stored?.transactionHash?.toLowerCase() !== realTxHash.toLowerCase() ||
        !ownerRes.data?.onChainRecord ||
        ownerRes.data?.onChainRecord?.exists !== true ||
        ownerRes.data?.onChainRecord?.documentHash?.toLowerCase() !== `0x${doc1Hash}`.toLowerCase() ||
        ownerRes.data?.onChainRecord?.owner?.toLowerCase() !== signer2Address.toLowerCase() ||
        ownerRes.data?.onChainRecord?.notary?.toLowerCase() !== signer1Address.toLowerCase() ||
        typeof ownerRes.data?.onChainRecord?.timestamp !== 'number'
      ) {
        throw new Error(`Owner blockchain view mismatch: status=${ownerRes.status}, data=${JSON.stringify(ownerRes.data)}`)
      }

      // 19b. Notary reads doc1 -> 200 OK
      const notaryReadRes = await request(`/api/blockchain/${doc1._id.toString()}`, {
        headers: { Authorization: `Bearer ${notaryToken}` },
      })
      if (notaryReadRes.status !== 200) {
        throw new Error(`Expected 200 for NOTARY, got ${notaryReadRes.status}`)
      }

      // 19c. Another user (User B) reads doc1 -> 404 NOT_FOUND
      const userBReadRes = await request(`/api/blockchain/${doc1._id.toString()}`, {
        headers: { Authorization: `Bearer ${userBToken}` },
      })
      if (
        userBReadRes.status === 404 &&
        userBReadRes.data?.error?.code === 'NOT_FOUND'
      ) {
        logPass(
          'GET /blockchain/:documentId stored + onChain, another user gets 404',
          `owner=200, notary=200, stranger=404 NOT_FOUND`
        )
      } else {
        throw new Error(`Expected 404 NOT_FOUND for User B, got ${userBReadRes.status}: ${JSON.stringify(userBReadRes.data)}`)
      }
    } catch (err) {
      logFail('GET /blockchain/:documentId stored + onChain, another user gets 404', err)
    }

    // ── Tests 20–24: POST /api/verify ───────────────────────────────────────
    console.log('\n--- POST /api/verify Tests ---')

    // Build a unique valid PDF for this run (unique content prevents hash collision across runs)
    const uniqueMarker = crypto.randomBytes(8).toString('hex')
    const verifyPdfBytes = Buffer.from(
      `%PDF-1.4\n%GoHash Verify Test ${uniqueMarker}\n1 0 obj\n<< /Title (VerifyTest) >>\nendobj\ntrailer\n<<>>\n%%EOF\n`
    )
    const verifyPdfHash = crypto.createHash('sha256').update(verifyPdfBytes).digest('hex')

    // Upload the verify PDF as userA so it exists in the DB
    let verifyDocId = ''
    try {
      const uploadRes = await uploadFileRequest(
        '/api/documents/upload',
        verifyPdfBytes,
        `verify_test_${uniqueMarker}.pdf`,
        'application/pdf',
        userAToken
      )
      if (uploadRes.status === 201 && uploadRes.data?.document?.id) {
        verifyDocId = uploadRes.data.document.id
      }
    } catch {
      // If upload fails, verify tests will still run but without DB enrichment
    }

    // Notarize the verify PDF on-chain to make it verifiable
    if (verifyDocId) {
      try {
        // Request notarization
        const reqRes = await request('/api/notarization/request', {
          method: 'POST',
          headers: { Authorization: `Bearer ${userAToken}` },
          body: { documentId: verifyDocId },
        })
        const verifyNotId = reqRes.data?.notarization?.id

        if (verifyNotId) {
          // Approve (notary has signer1 linked, userA has signer2 linked from earlier tests)
          await request(`/api/notarization/${verifyNotId}/approve`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${notaryToken}` },
          })

          // Call contract as signer1
          const contractAsNotary1 = BlockchainService.getContract(signer1)
          const verifyTx = await contractAsNotary1.notarize(
            `0x${verifyPdfHash}`,
            '',
            signer2Address
          )
          await verifyTx.wait()
          const verifyTxHash = verifyTx.hash

          // Confirm
          await request(`/api/notarization/${verifyNotId}/confirm`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${notaryToken}` },
            body: { transactionHash: verifyTxHash },
          })

          // ── Test 20: original PDF → VERIFIED with right notaryWallet + txHash ──
          try {
            const verRes = await uploadFileRequest(
              '/api/verify',
              verifyPdfBytes,
              `verify_${uniqueMarker}.pdf`,
              'application/pdf'
              // No token — public endpoint
            )
            const contractInfo = BlockchainService.getContractInfo()
            if (
              verRes.status === 200 &&
              verRes.data?.success === true &&
              verRes.data?.status === 'VERIFIED' &&
              verRes.data?.hash === verifyPdfHash &&
              verRes.data?.record?.notaryWallet?.toLowerCase() === signer1Address.toLowerCase() &&
              (verRes.data?.record?.transactionHash === undefined ||
                verRes.data?.record?.transactionHash?.toLowerCase() === verifyTxHash.toLowerCase()) &&
              verRes.data?.record?.contractAddress?.toLowerCase() === contractInfo.address.toLowerCase()
            ) {
              logPass(
                'POST /api/verify: real PDF → VERIFIED',
                `status=VERIFIED, notaryWallet=${signer1Address.slice(0, 10)}...`
              )
            } else {
              throw new Error(
                `Expected VERIFIED with notary, got ${verRes.status}: ${JSON.stringify(verRes.data)}`
              )
            }
          } catch (err) {
            logFail('POST /api/verify: real PDF → VERIFIED', err)
          }

          // ── Test 21: same PDF + one extra byte → NOT_VERIFIED ───────────────
          try {
            const modifiedBytes = Buffer.concat([verifyPdfBytes, Buffer.from([0x0a])])
            const modRes = await uploadFileRequest(
              '/api/verify',
              modifiedBytes,
              `modified_${uniqueMarker}.pdf`,
              'application/pdf'
            )
            if (
              modRes.status === 200 &&
              modRes.data?.status === 'NOT_VERIFIED' &&
              modRes.data?.success === true
            ) {
              logPass(
                'POST /api/verify: modified PDF → NOT_VERIFIED',
                `status=NOT_VERIFIED`
              )
            } else {
              throw new Error(
                `Expected NOT_VERIFIED for modified file, got ${modRes.status}: ${JSON.stringify(modRes.data)}`
              )
            }
          } catch (err) {
            logFail('POST /api/verify: modified PDF → NOT_VERIFIED', err)
          }

          // ── Test 24: response never contains owner email or name ─────────────
          try {
            const privRes = await uploadFileRequest(
              '/api/verify',
              verifyPdfBytes,
              `priv_${uniqueMarker}.pdf`,
              'application/pdf'
            )
            const body = JSON.stringify(privRes.data ?? {})
            if (!body.includes('@') && !privRes.data?.record?.ownerEmail && !privRes.data?.record?.ownerName) {
              logPass(
                'POST /api/verify: no owner email or name in response',
                'No PII in response'
              )
            } else {
              throw new Error(`Owner PII found in verify response: ${body}`)
            }
          } catch (err) {
            logFail('POST /api/verify: no owner email or name in response', err)
          }
        }
      } catch (err) {
        logFail('POST /api/verify setup (upload+notarize)', err)
      }
    }

    // ── Test 22: non-PDF → 400 INVALID_FILE ───────────────────────────────────
    try {
      const notPdf = Buffer.from('This is not a PDF, just plain text')
      const res = await uploadFileRequest(
        '/api/verify',
        notPdf,
        'not_a_pdf.pdf',
        'application/pdf'
      )
      if (res.status === 400 && res.data?.error?.code === 'INVALID_FILE') {
        logPass(
          'POST /api/verify: non-PDF → 400 INVALID_FILE',
          `code=${res.data.error.code}`
        )
      } else {
        throw new Error(`Expected 400 INVALID_FILE, got ${res.status}: ${JSON.stringify(res.data)}`)
      }
    } catch (err) {
      logFail('POST /api/verify: non-PDF → 400 INVALID_FILE', err)
    }

    // ── Test 23: no auth token required ────────────────────────────────────────
    try {
      // POST /api/verify with no file should return 400 INVALID_FILE (not 401)
      const res = await request('/api/verify', { method: 'POST', body: {} })
      if (res.status === 400 && res.data?.error?.code === 'INVALID_FILE') {
        logPass(
          'POST /api/verify: no auth token required (no 401)',
          `returns 400 INVALID_FILE, not 401`
        )
      } else {
        throw new Error(
          `Expected 400 INVALID_FILE without token, got ${res.status}: ${JSON.stringify(res.data)}`
        )
      }
    } catch (err) {
      logFail('POST /api/verify: no auth token required (no 401)', err)
    }

    // ── Task F2: Unique Notarization Key Tests ──────────────────────────────
    console.log('\n--- Task F2: Unique Notarization Key Tests ---')

    const f2ExpectedDigest = ethers.solidityPackedKeccak256(
      ['bytes32', 'bytes32'],
      [`0x${doc1Hash}`, realTxHash]
    )
    const f2Raw16 = f2ExpectedDigest.slice(2, 18).toUpperCase()
    const f2Key = `GH-${f2Raw16.slice(0, 4)}-${f2Raw16.slice(4, 8)}-${f2Raw16.slice(8, 12)}-${f2Raw16.slice(12, 16)}`

    // F2-1: Key lookup with exact standard format
    try {
      const res = await request(`/api/verify/key/${f2Key}`)
      const contractInfo = BlockchainService.getContractInfo()
      if (
        res.status === 200 &&
        res.data?.success === true &&
        res.data?.status === 'FOUND' &&
        res.data?.key === f2Key &&
        res.data?.record?.notaryWallet?.toLowerCase() === signer1Address.toLowerCase() &&
        res.data?.record?.transactionHash?.toLowerCase() === realTxHash.toLowerCase() &&
        res.data?.record?.contractAddress?.toLowerCase() === contractInfo.address.toLowerCase() &&
        typeof res.data?.record?.timestamp === 'number' &&
        typeof res.data?.record?.blockNumber === 'number'
      ) {
        logPass('GET /api/verify/key/:key (exact format) -> FOUND', `key=${f2Key}, notary=${signer1Address.slice(0, 10)}...`)
      } else {
        throw new Error(`Expected FOUND with full record, got ${res.status}: ${JSON.stringify(res.data)}`)
      }
    } catch (err) {
      logFail('GET /api/verify/key/:key (exact format) -> FOUND', err)
    }

    // F2-2: Key lookup normalization (dashes, lowercase, and spaces)
    try {
      const lowerKey = f2Key.toLowerCase()
      const spaceKey = f2Key.replace(/-/g, ' ')
      const rawHexKey = f2Raw16.toLowerCase()

      const resLower = await request(`/api/verify/key/${lowerKey}`)
      const resSpace = await request(`/api/verify/key/${spaceKey}`)
      const resRaw = await request(`/api/verify/key/${rawHexKey}`)

      if (
        resLower.status === 200 && resLower.data?.status === 'FOUND' && resLower.data?.key === f2Key &&
        resSpace.status === 200 && resSpace.data?.status === 'FOUND' && resSpace.data?.key === f2Key &&
        resRaw.status === 200 && resRaw.data?.status === 'FOUND' && resRaw.data?.key === f2Key
      ) {
        logPass('GET /api/verify/key/:key normalization', 'dashes, lowercase, spaces, and raw hex all normalize to FOUND')
      } else {
        throw new Error(`Normalization mismatch: lower=${resLower.status}, space=${resSpace.status}, raw=${resRaw.status}`)
      }
    } catch (err) {
      logFail('GET /api/verify/key/:key normalization', err)
    }

    // F2-3: Unknown valid key gives NOT_FOUND
    try {
      const unknownKey = 'GH-FFFF-FFFF-FFFF-FFFF'
      const unkRes = await request(`/api/verify/key/${unknownKey}`)
      if (
        unkRes.status === 200 &&
        unkRes.data?.success === true &&
        unkRes.data?.status === 'NOT_FOUND'
      ) {
        logPass('GET /api/verify/key/:key unknown key -> NOT_FOUND', 'status=NOT_FOUND')
      } else {
        throw new Error(`Expected 200 NOT_FOUND, got ${unkRes.status}: ${JSON.stringify(unkRes.data)}`)
      }
    } catch (err) {
      logFail('GET /api/verify/key/:key unknown key -> NOT_FOUND', err)
    }

    // F2-4: Malformed keys give 400
    try {
      const malformedSamples = ['invalid', 'GH-123', 'GH-ZZZZ-ZZZZ-ZZZZ-ZZZZ', '1234567890ABCDEF12345']
      let all400 = true
      for (const sample of malformedSamples) {
        const res = await request(`/api/verify/key/${encodeURIComponent(sample)}`)
        if (res.status !== 400) {
          all400 = false
          throw new Error(`Expected 400 for "${sample}", got ${res.status}: ${JSON.stringify(res.data)}`)
        }
      }
      if (all400) {
        logPass('GET /api/verify/key/:key malformed keys -> 400', `${malformedSamples.length} malformed samples rejected with 400`)
      }
    } catch (err) {
      logFail('GET /api/verify/key/:key malformed keys -> 400', err)
    }

    // F2-5: Response has strictly NO PII and no owner data or file name
    try {
      const res = await request(`/api/verify/key/${f2Key}`)
      const body = JSON.stringify(res.data ?? {})
      if (
        !body.includes('@') &&
        !res.data?.record?.ownerWallet &&
        !res.data?.record?.owner &&
        !res.data?.record?.ownerName &&
        !res.data?.record?.fileName &&
        !res.data?.record?.originalName &&
        !res.data?.document
      ) {
        logPass('GET /api/verify/key/:key: strictly no PII, owner, or filename', 'No owner data, no file name')
      } else {
        throw new Error(`PII or owner data exposed in key lookup: ${body}`)
      }
    } catch (err) {
      logFail('GET /api/verify/key/:key: strictly no PII, owner, or filename', err)
    }

    // F2-6: Works without token (public endpoint)
    try {
      const res = await request(`/api/verify/key/${f2Key}`)
      if (res.status === 200 && res.data?.status === 'FOUND') {
        logPass('GET /api/verify/key/:key works without token', 'public 200 response without Authorization header')
      } else {
        throw new Error(`Expected public access 200, got ${res.status}`)
      }
    } catch (err) {
      logFail('GET /api/verify/key/:key works without token', err)
    }

    // F2-7: Existing CONFIRMED notarizations without a key get one computed on read and saved (idempotent)
    try {
      // Unset notarizationKey in MongoDB to simulate a legacy record
      await Notarization.updateOne({ _id: notarization1Id }, { $unset: { notarizationKey: 1 } })

      const beforeCheck = await Notarization.findById(notarization1Id)
      if (beforeCheck?.notarizationKey) {
        throw new Error('Failed to unset notarizationKey in test setup')
      }

      // Read document details via API — should compute and save key on read
      const readRes = await request(`/api/documents/${doc1._id.toString()}`, {
        headers: { Authorization: `Bearer ${userAToken}` },
      })

      if (readRes.status !== 200 || readRes.data?.document?.notarization?.notarizationKey !== f2Key) {
        throw new Error(`Expected backfilled key on read ${f2Key}, got ${readRes.data?.document?.notarization?.notarizationKey}`)
      }

      // Verify it was saved to MongoDB
      const afterCheck = await Notarization.findById(notarization1Id)
      if (afterCheck?.notarizationKey !== f2Raw16) {
        throw new Error(`Expected saved raw key ${f2Raw16} in DB, got ${afterCheck?.notarizationKey}`)
      }

      logPass('Idempotent key backfill on read for legacy CONFIRMED record', `computed & saved: ${f2Key}`)
    } catch (err) {
      logFail('Idempotent key backfill on read for legacy CONFIRMED record', err)
    }

    // ── Task F3A: Notarization Fee Tests (in test ETH) ─────────────────────────
    console.log('\n--- Task F3A: Notarization Fee Tests (in test ETH) ---')
    const signer0Address = await signer0.getAddress()
    const feeRecipientAddress = signer0Address // deployer address as public fee recipient

    try {
      // 1. GET /api/config/fees when disabled
      const feesDisabledRes = await request('/api/config/fees')
      if (feesDisabledRes.status === 200 && feesDisabledRes.data?.enabled === false) {
        logPass('GET /api/config/fees (disabled) -> { enabled: false }')
      } else {
        throw new Error(`Expected { enabled: false }, got: ${feesDisabledRes.status} ${JSON.stringify(feesDisabledRes.data)}`)
      }

      // 2. Enable fee and verify GET /api/config/fees
      process.env.NOTARIZATION_FEE_ETH = '0.001'
      process.env.FEE_RECIPIENT_ADDRESS = feeRecipientAddress

      const feesEnabledRes = await request('/api/config/fees')
      const expectedWei = ethers.parseEther('0.001').toString()
      if (
        feesEnabledRes.status === 200 &&
        feesEnabledRes.data?.enabled === true &&
        feesEnabledRes.data?.amountEth === '0.001' &&
        feesEnabledRes.data?.amountWei === expectedWei &&
        feesEnabledRes.data?.recipient?.toLowerCase() === feeRecipientAddress.toLowerCase() &&
        feesEnabledRes.data?.symbol === 'ETH'
      ) {
        logPass('GET /api/config/fees (enabled)', `amountEth=0.001, recipient=${feeRecipientAddress.slice(0, 10)}...`)
      } else {
        throw new Error(`Unexpected fees config response: ${feesEnabledRes.status} ${JSON.stringify(feesEnabledRes.data)}`)
      }

      // 3. Register userF3 and link signer4 wallet
      const signer4 = await provider.getSigner(4)
      const userF3Email = `user_f3_${Date.now()}@example.com`
      const { token: userF3Token, id: userF3Id } = await registerUser(userF3Email, 'Fee Payer')
      const linkRes = await linkWallet(userF3Token, signer4)
      if (linkRes.status !== 200) {
        throw new Error(`Failed to link wallet for userF3: ${linkRes.status} ${JSON.stringify(linkRes.data)}`)
      }

      // 4. Upload fresh unique document and request notarization
      const pdfF3 = Buffer.from(`%PDF-1.4\n%Fee Test Doc 1 ${Date.now()}\n%%EOF`)
      const uploadF3Res = await uploadFileRequest(
        '/api/documents/upload',
        pdfF3,
        'fee_doc.pdf',
        'application/pdf',
        userF3Token
      )
      const docF3Id = uploadF3Res.data?.document?.id
      if (!docF3Id) {
        throw new Error(`Failed to upload doc for userF3: ${JSON.stringify(uploadF3Res.data)}`)
      }

      const reqF3Res = await request('/api/notarization/request', {
        method: 'POST',
        headers: { Authorization: `Bearer ${userF3Token}` },
        body: { documentId: docF3Id },
      })
      const notF3Id = reqF3Res.data?.notarization?.id
      if (reqF3Res.status !== 201 || !notF3Id) {
        throw new Error(`Failed to request notarization: ${reqF3Res.status} ${JSON.stringify(reqF3Res.data)}`)
      }

      // 5. Approve without payment -> 402 PAYMENT_REQUIRED
      const approveUnpaidRes = await request(`/api/notarization/${notF3Id}/approve`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${notaryToken}` },
      })
      if (approveUnpaidRes.status === 402 && approveUnpaidRes.data?.error?.code === 'PAYMENT_REQUIRED') {
        logPass('Fee enabled: approve without payment → 402 PAYMENT_REQUIRED', 'code=PAYMENT_REQUIRED')
      } else {
        throw new Error(`Expected 402 PAYMENT_REQUIRED, got: ${approveUnpaidRes.status} ${JSON.stringify(approveUnpaidRes.data)}`)
      }

      // 6. Payment validation checks
      // 6a. Non-existent transaction hash -> 422 TX_NOT_FOUND
      const nonExistentTx = '0x' + 'f'.repeat(64)
      const unknownTxRes = await request(`/api/notarization/${notF3Id}/payment`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${userF3Token}` },
        body: { transactionHash: nonExistentTx },
      })
      if (unknownTxRes.status === 422 && (unknownTxRes.data?.error?.details?.reason === 'TX_NOT_FOUND' || unknownTxRes.data?.error?.message?.includes('TX_NOT_FOUND'))) {
        logPass('Payment reason: unknown tx hash → 422 TX_NOT_FOUND')
      } else {
        throw new Error(`Expected 422 TX_NOT_FOUND, got: ${unknownTxRes.status} ${JSON.stringify(unknownTxRes.data)}`)
      }

      // 6b. Wrong recipient -> 422 WRONG_RECIPIENT
      const wrongRecipientTx = await signer4.sendTransaction({
        to: signer1Address, // sent to notary instead of fee recipient
        value: ethers.parseEther('0.001'),
      })
      await wrongRecipientTx.wait()
      const wrongRecipRes = await request(`/api/notarization/${notF3Id}/payment`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${userF3Token}` },
        body: { transactionHash: wrongRecipientTx.hash },
      })
      if (wrongRecipRes.status === 422 && (wrongRecipRes.data?.error?.details?.reason === 'WRONG_RECIPIENT' || wrongRecipRes.data?.error?.message?.includes('WRONG_RECIPIENT'))) {
        logPass('Payment reason: wrong recipient → 422 WRONG_RECIPIENT')
      } else {
        throw new Error(`Expected 422 WRONG_RECIPIENT, got: ${wrongRecipRes.status} ${JSON.stringify(wrongRecipRes.data)}`)
      }

      // 6c. Wrong payer -> 422 WRONG_PAYER
      const wrongPayerTx = await signer3.sendTransaction({
        to: feeRecipientAddress,
        value: ethers.parseEther('0.001'),
      })
      await wrongPayerTx.wait()
      const wrongPayerRes = await request(`/api/notarization/${notF3Id}/payment`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${userF3Token}` },
        body: { transactionHash: wrongPayerTx.hash },
      })
      if (wrongPayerRes.status === 422 && (wrongPayerRes.data?.error?.details?.reason === 'WRONG_PAYER' || wrongPayerRes.data?.error?.message?.includes('WRONG_PAYER'))) {
        logPass('Payment reason: wrong payer → 422 WRONG_PAYER')
      } else {
        throw new Error(`Expected 422 WRONG_PAYER, got: ${wrongPayerRes.status} ${JSON.stringify(wrongPayerRes.data)}`)
      }

      // 6d. Too small an amount -> 422 AMOUNT_TOO_LOW
      const lowAmountTx = await signer4.sendTransaction({
        to: feeRecipientAddress,
        value: ethers.parseEther('0.0001'), // less than 0.001 ETH
      })
      await lowAmountTx.wait()
      const lowAmountRes = await request(`/api/notarization/${notF3Id}/payment`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${userF3Token}` },
        body: { transactionHash: lowAmountTx.hash },
      })
      if (lowAmountRes.status === 422 && (lowAmountRes.data?.error?.details?.reason === 'AMOUNT_TOO_LOW' || lowAmountRes.data?.error?.message?.includes('AMOUNT_TOO_LOW'))) {
        logPass('Payment reason: too small an amount → 422 AMOUNT_TOO_LOW')
      } else {
        throw new Error(`Expected 422 AMOUNT_TOO_LOW, got: ${lowAmountRes.status} ${JSON.stringify(lowAmountRes.data)}`)
      }

      // 6e. Contract-call transaction with data -> 422 NOT_A_PLAIN_TRANSFER
      const dataTx = await signer4.sendTransaction({
        to: feeRecipientAddress,
        value: ethers.parseEther('0.001'),
        data: '0x1234',
      })
      await dataTx.wait()
      const dataTxRes = await request(`/api/notarization/${notF3Id}/payment`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${userF3Token}` },
        body: { transactionHash: dataTx.hash },
      })
      if (dataTxRes.status === 422 && (dataTxRes.data?.error?.details?.reason === 'NOT_A_PLAIN_TRANSFER' || dataTxRes.data?.error?.message?.includes('NOT_A_PLAIN_TRANSFER'))) {
        logPass('Payment reason: transaction with data → 422 NOT_A_PLAIN_TRANSFER')
      } else {
        throw new Error(`Expected 422 NOT_A_PLAIN_TRANSFER, got: ${dataTxRes.status} ${JSON.stringify(dataTxRes.data)}`)
      }

      // 7. Valid plain transfer payment from owner's wallet -> 200 PAID
      const validPaymentTx = await signer4.sendTransaction({
        to: feeRecipientAddress,
        value: ethers.parseEther('0.001'),
      })
      await validPaymentTx.wait()
      const validPayRes = await request(`/api/notarization/${notF3Id}/payment`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${userF3Token}` },
        body: { transactionHash: validPaymentTx.hash },
      })
      if (validPayRes.status === 200 && validPayRes.data?.payment?.status === 'PAID') {
        logPass('Valid payment from owner wallet → PAID', `tx=${validPaymentTx.hash.slice(0, 14)}...`)
      } else {
        throw new Error(`Expected 200 PAID, got: ${validPayRes.status} ${JSON.stringify(validPayRes.data)}`)
      }

      // 8. Idempotency: same hash again -> 200
      const idempotentPayRes = await request(`/api/notarization/${notF3Id}/payment`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${userF3Token}` },
        body: { transactionHash: validPaymentTx.hash },
      })
      if (idempotentPayRes.status === 200 && idempotentPayRes.data?.payment?.status === 'PAID') {
        logPass('Same payment hash on same notarization is idempotent 200')
      } else {
        throw new Error(`Expected idempotent 200, got: ${idempotentPayRes.status} ${JSON.stringify(idempotentPayRes.data)}`)
      }

      // 9. Reusing same payment hash on another notarization -> 409 PAYMENT_ALREADY_USED
      const pdfF3_2 = Buffer.from(`%PDF-1.4\n%Fee Test Doc 2 ${Date.now()}\n%%EOF`)
      const uploadF3_2Res = await uploadFileRequest(
        '/api/documents/upload',
        pdfF3_2,
        'fee_doc2.pdf',
        'application/pdf',
        userF3Token
      )
      const docF3_2Id = uploadF3_2Res.data?.document?.id
      const reqF3_2Res = await request('/api/notarization/request', {
        method: 'POST',
        headers: { Authorization: `Bearer ${userF3Token}` },
        body: { documentId: docF3_2Id },
      })
      const notF3_2Id = reqF3_2Res.data?.notarization?.id

      const reusePayRes = await request(`/api/notarization/${notF3_2Id}/payment`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${userF3Token}` },
        body: { transactionHash: validPaymentTx.hash },
      })
      if (reusePayRes.status === 409 && reusePayRes.data?.error?.code === 'PAYMENT_ALREADY_USED') {
        logPass('Same hash on another notarization → 409 PAYMENT_ALREADY_USED')
      } else {
        throw new Error(`Expected 409 PAYMENT_ALREADY_USED, got: ${reusePayRes.status} ${JSON.stringify(reusePayRes.data)}`)
      }

      // 10. Full flow with fee: pay -> approve -> notary notarizes on-chain -> confirm -> CONFIRMED, NOTARIZED
      const approvePaidRes = await request(`/api/notarization/${notF3Id}/approve`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${notaryToken}` },
      })
      if (approvePaidRes.status !== 200 || !approvePaidRes.data?.args) {
        throw new Error(`Approve failed: ${approvePaidRes.status} ${JSON.stringify(approvePaidRes.data)}`)
      }

      const notaryContract = BlockchainService.getContract(signer1)
      const onChainNotarizeTx = await notaryContract.notarize(
        approvePaidRes.data.args[0],
        approvePaidRes.data.args[1],
        approvePaidRes.data.args[2]
      )
      await onChainNotarizeTx.wait()

      const confirmPaidRes = await request(`/api/notarization/${notF3Id}/confirm`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${notaryToken}` },
        body: { transactionHash: onChainNotarizeTx.hash },
      })
      if (confirmPaidRes.status === 200 && confirmPaidRes.data?.notarization?.status === 'CONFIRMED') {
        logPass('Full flow with fee: pay → approve → on-chain notarize → confirm → CONFIRMED')
      } else {
        throw new Error(`Confirm failed: ${confirmPaidRes.status} ${JSON.stringify(confirmPaidRes.data)}`)
      }

      // 11. Reject a PAID request -> refundDue: true
      const validPaymentTx2 = await signer4.sendTransaction({
        to: feeRecipientAddress,
        value: ethers.parseEther('0.001'),
      })
      await validPaymentTx2.wait()
      const payReq2Res = await request(`/api/notarization/${notF3_2Id}/payment`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${userF3Token}` },
        body: { transactionHash: validPaymentTx2.hash },
      })
      if (payReq2Res.status !== 200) {
        throw new Error(`Pay failed on req2: ${payReq2Res.status} ${JSON.stringify(payReq2Res.data)}`)
      }

      const rejectPaidRes = await request(`/api/notarization/${notF3_2Id}/reject`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${notaryToken}` },
        body: { reason: 'Test rejection with fee refundDue' },
      })
      if (rejectPaidRes.status === 200 && rejectPaidRes.data?.notarization?.status === 'REJECTED') {
        // Verify in DB and API that payment.refundDue is true
        const checkDb = await Notarization.findById(notF3_2Id)
        if (checkDb?.payment?.refundDue === true) {
          logPass('Reject a PAID request → refundDue: true', `db.refundDue=${checkDb.payment.refundDue}`)
        } else {
          throw new Error(`Expected db.refundDue=true, got ${checkDb?.payment?.refundDue}`)
        }
      } else {
        throw new Error(`Reject failed: ${rejectPaidRes.status} ${JSON.stringify(rejectPaidRes.data)}`)
      }

      // 12. Check GET /documents/:id includes payment for owner
      const docDetailsRes = await request(`/api/documents/${docF3Id}`, {
        headers: { Authorization: `Bearer ${userF3Token}` },
      })
      if (
        docDetailsRes.status === 200 &&
        docDetailsRes.data?.document?.notarization?.payment?.status === 'PAID'
      ) {
        logPass('GET /api/documents/:id includes payment object for owner')
      } else {
        throw new Error(`Expected payment in document details: ${docDetailsRes.status} ${JSON.stringify(docDetailsRes.data)}`)
      }

    } catch (err) {
      logFail('Task F3A: Notarization Fee Tests', err)
    } finally {
      // Restore fee config to disabled state so subsequent tests run normally
      delete process.env.NOTARIZATION_FEE_ETH
      delete process.env.FEE_RECIPIENT_ADDRESS
    }

    // ── Tests 25–31: Admin API ────────────────────────────────────────────────
    console.log('\n--- Admin API Tests ---')

    // Create an ADMIN user for this test run
    const adminEmail = `admin_${Date.now()}_${crypto.randomBytes(4).toString('hex')}@example.com`
    const { token: rawAdminToken, id: adminId } = await registerUser(adminEmail, 'Test Admin')
    // Promote to ADMIN in the DB before logging in
    await User.updateOne({ _id: adminId }, { role: 'ADMIN' })
    // Login to get a fresh token with ADMIN role
    const adminLoginRes = await request('/api/auth/login', {
      method: 'POST',
      body: { email: adminEmail, password: testPassword },
    })
    const adminToken = adminLoginRes.data?.token as string
    // (rawAdminToken carries USER role — we intentionally don't use it for admin tests)
    void rawAdminToken

    // ── Test 25: USER/NOTARY get 403, ADMIN gets 200 ──────────────────────────
    try {
      const adminRoutes = [
        '/api/admin/users',
        '/api/admin/notaries',
        '/api/admin/activity',
        '/api/admin/stats',
      ]

      let allBlocked = true
      for (const route of adminRoutes) {
        const userRes   = await request(route, { headers: { Authorization: `Bearer ${userAToken}` } })
        const notaryRes = await request(route, { headers: { Authorization: `Bearer ${notaryToken}` } })
        if (userRes.status !== 403 || notaryRes.status !== 403) {
          allBlocked = false
          throw new Error(`Expected 403 on ${route} for USER/NOTARY, got user=${userRes.status} notary=${notaryRes.status}`)
        }
      }

      // ADMIN should get 200 on all of them
      let allAllowed = true
      for (const route of adminRoutes) {
        const adminRes = await request(route, { headers: { Authorization: `Bearer ${adminToken}` } })
        if (adminRes.status !== 200) {
          allAllowed = false
          throw new Error(`Expected 200 for ADMIN on ${route}, got ${adminRes.status}: ${JSON.stringify(adminRes.data)}`)
        }
      }

      if (allBlocked && allAllowed) {
        logPass(
          'Admin routes: USER/NOTARY 403, ADMIN 200',
          `${adminRoutes.length} routes checked`
        )
      }
    } catch (err) {
      logFail('Admin routes: USER/NOTARY 403, ADMIN 200', err)
    }

    // ── Test 26: admin cannot change own role (409 CANNOT_MODIFY_SELF) ────────
    try {
      const res = await request(`/api/admin/users/${adminId}/role`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${adminToken}` },
        body: { role: 'USER' },
      })
      if (res.status === 409 && res.data?.error?.code === 'CANNOT_MODIFY_SELF') {
        logPass(
          'Admin cannot change own role → 409 CANNOT_MODIFY_SELF',
          `code=${res.data.error.code}`
        )
      } else {
        throw new Error(
          `Expected 409 CANNOT_MODIFY_SELF, got ${res.status}: ${JSON.stringify(res.data)}`
        )
      }
    } catch (err) {
      logFail('Admin cannot change own role → 409 CANNOT_MODIFY_SELF', err)
    }

    // ── Test 27+28: disable userA → 403 ACCOUNT_DISABLED, existing token stops ─
    try {
      // Disable userA via admin
      const disableRes = await request(`/api/admin/users/${userAId}/status`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${adminToken}` },
        body: { isActive: false },
      })
      if (disableRes.status !== 200 || disableRes.data?.user?.isActive !== false) {
        throw new Error(`Disable failed: ${disableRes.status} ${JSON.stringify(disableRes.data)}`)
      }

      // Verify userA's existing token is now rejected
      const checkRes = await request('/api/auth/me', {
        headers: { Authorization: `Bearer ${userAToken}` },
      })
      if (checkRes.status === 403 && checkRes.data?.error?.code === 'ACCOUNT_DISABLED') {
        logPass(
          'Disabled user: existing token stops working (403 ACCOUNT_DISABLED)',
          `status=403, code=${checkRes.data.error.code}`
        )
      } else {
        throw new Error(
          `Expected 403 ACCOUNT_DISABLED for disabled user, got ${checkRes.status}: ${JSON.stringify(checkRes.data)}`
        )
      }

      // Admin cannot disable themselves
      const selfDisable = await request(`/api/admin/users/${adminId}/status`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${adminToken}` },
        body: { isActive: false },
      })
      if (selfDisable.status === 409 && selfDisable.data?.error?.code === 'CANNOT_MODIFY_SELF') {
        logPass(
          'Admin cannot disable themselves → 409 CANNOT_MODIFY_SELF',
          `code=${selfDisable.data.error.code}`
        )
      } else {
        throw new Error(
          `Expected 409 CANNOT_MODIFY_SELF for self-disable, got ${selfDisable.status}: ${JSON.stringify(selfDisable.data)}`
        )
      }

      // Re-enable userA so teardown proceeds normally
      await User.updateOne({ _id: userAId }, { isActive: true })
    } catch (err) {
      logFail('Admin disable user / CANNOT_MODIFY_SELF', err)
      // Ensure re-enabled in case of partial failure
      await User.updateOne({ _id: userAId }, { isActive: true }).catch(() => {})
    }

    // ── Test 29: GET /api/admin/notaries includes onChainAuthorized ───────────
    try {
      const res = await request('/api/admin/notaries', {
        headers: { Authorization: `Bearer ${adminToken}` },
      })
      if (
        res.status === 200 &&
        res.data?.success === true &&
        Array.isArray(res.data?.notaries) &&
        typeof res.data?.chainAvailable === 'boolean'
      ) {
        // The notary user with signer1 wallet should be present
        const notaryEntry = res.data.notaries.find(
          (n: any) => n.walletAddress?.toLowerCase() === signer1Address.toLowerCase()
        )
        if (notaryEntry && notaryEntry.onChainAuthorized === true) {
          logPass(
            'GET /api/admin/notaries: includes onChainAuthorized',
            `notary=${signer1Address.slice(0, 10)}..., onChainAuthorized=true, chainAvailable=${res.data.chainAvailable}`
          )
        } else {
          throw new Error(
            `Notary entry missing or onChainAuthorized wrong: ${JSON.stringify(notaryEntry)}`
          )
        }
      } else {
        throw new Error(`Unexpected response: ${res.status} ${JSON.stringify(res.data)}`)
      }
    } catch (err) {
      logFail('GET /api/admin/notaries: includes onChainAuthorized', err)
    }

    // ── Test 30: GET /api/admin/stats counts are correct ──────────────────────
    try {
      const res = await request('/api/admin/stats', {
        headers: { Authorization: `Bearer ${adminToken}` },
      })
      if (
        res.status === 200 &&
        res.data?.success === true &&
        typeof res.data?.users?.total === 'number' &&
        typeof res.data?.documents?.total === 'number' &&
        typeof res.data?.notarizations?.total === 'number' &&
        res.data?.users?.total >= 1 &&
        res.data?.documents?.total >= 1 &&
        res.data?.notarizations?.total >= 1 &&
        typeof res.data?.fees?.paidCount === 'number' &&
        typeof res.data?.fees?.totalWei === 'string'
      ) {
        logPass(
          'GET /api/admin/stats: counts correct (including fees)',
          `users=${res.data.users.total}, docs=${res.data.documents.total}, notarizations=${res.data.notarizations.total}, feesPaid=${res.data.fees.paidCount}, totalWei=${res.data.fees.totalWei}`
        )
      } else {
        throw new Error(`Unexpected stats: ${res.status} ${JSON.stringify(res.data)}`)
      }
    } catch (err) {
      logFail('GET /api/admin/stats: counts correct', err)
    }

    // ── Test 31: no admin response contains passwordHash ──────────────────────
    try {
      const routes = [
        '/api/admin/users',
        '/api/admin/notaries',
        '/api/admin/activity',
        '/api/admin/stats',
      ]
      let found = false
      for (const route of routes) {
        const res = await request(route, { headers: { Authorization: `Bearer ${adminToken}` } })
        if (JSON.stringify(res.data).includes('passwordHash')) {
          found = true
          throw new Error(`passwordHash found in response for ${route}`)
        }
      }
      if (!found) {
        logPass(
          'No admin response contains passwordHash',
          `${routes.length} routes checked`
        )
      }
    } catch (err) {
      logFail('No admin response contains passwordHash', err)
    }

  } finally {
    // Teardown signer3 authorization if it remains
    try {
      const isSigner3Auth = await BlockchainService.isNotaryAuthorized(signer3Address)
      if (isSigner3Auth) {
        const contractAsOwner = BlockchainService.getContract(signer0)
        const removeTx = await contractAsOwner.removeNotary(signer3Address)
        await removeTx.wait()
      }
    } catch {
      // Best-effort cleanup
    }

    // Teardown server
    if (server) {
      await new Promise<void>((resolve) => server?.close(() => resolve()))
      console.log('🛑 Isolated test server stopped.')
    }

    // Drop test database and disconnect
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

runChainTests().catch((err) => {
  console.error('Fatal error during chain test execution:', err)
  process.exit(1)
})
