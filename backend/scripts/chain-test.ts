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
 *   • signer.signMessage() is ethers test tooling only — no key ever enters
 *     backend source code.
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
 * ─────────────────────────────────────────────────────────────────────────────
 */

import http from 'http'
import mongoose from 'mongoose'
import { ethers } from 'ethers'
import app from '../src/app'
import { User } from '../src/models/User'
import { BlockchainService } from '../src/services/blockchain.service'

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
  const signer1Address = await signer1.getAddress()
  const signer2Address = await signer2.getAddress()

  const testPassword = 'Password123!'

  // Helper: register a user and return {token, id}
  async function registerUser(email: string, name = 'Chain Tester') {
    const res = await request('/api/auth/register', {
      method: 'POST',
      body: { name, email, password: testPassword, confirmPassword: testPassword },
    })
    return { token: res.data?.token as string, id: res.data?.user?.id as string }
  }

  const testEmail = `chain_test_${Date.now()}@example.com`
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
    // env.DEPLOYMENT_FILE is a cached Zod-parsed object; mutate it temporarily.
    try {
      // Import env directly to mutate the cached object
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
      const nonceRes = await request('/api/auth/wallet/nonce', {
        method: 'POST',
        headers: { Authorization: `Bearer ${authToken}` },
      })
      if (nonceRes.status !== 200 || !nonceRes.data?.message) {
        throw new Error(`Nonce request failed: ${JSON.stringify(nonceRes.data)}`)
      }
      const message = nonceRes.data.message as string

      // signer2 signs the nonce message (test-only; uses provider.getSigner)
      const sig = await signer2.signMessage(message)

      const patchRes = await request('/api/auth/wallet', {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${authToken}` },
        body: { walletAddress: signer2Address, signature: sig },
      })

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
    // signer0 signs the message, but we claim walletAddress is signer2Address
    try {
      const nonceRes = await request('/api/auth/wallet/nonce', {
        method: 'POST',
        headers: { Authorization: `Bearer ${authToken}` },
      })
      const message = nonceRes.data.message as string

      // signer0 signs but we claim signer2's address
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
    // After the first call clears the nonce, the second call must fail.
    try {
      const nonceRes = await request('/api/auth/wallet/nonce', {
        method: 'POST',
        headers: { Authorization: `Bearer ${authToken}` },
      })
      const message = nonceRes.data.message as string
      const sig = await signer2.signMessage(message)

      // First call — nonce gets consumed (may succeed or fail, doesn't matter)
      await request('/api/auth/wallet', {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${authToken}` },
        body: { walletAddress: signer2Address, signature: sig },
      })

      // Second call with same (now-cleared) nonce -> NONCE_INVALID
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
    // testUser already has signer2Address linked. Register a second user and try.
    try {
      const user2Email = `chain_user2_${Date.now()}@example.com`
      const { token: token2, id: id2 } = await registerUser(user2Email, 'Chain User 2')

      const nonceRes = await request('/api/auth/wallet/nonce', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token2}` },
      })
      const message = nonceRes.data.message as string

      // signer2 signs for user2, but signer2Address is already owned by testUser
      const sig = await signer2.signMessage(message)

      const patchRes = await request('/api/auth/wallet', {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token2}` },
        body: { walletAddress: signer2Address, signature: sig },
      })

      // Clean up user2
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
    }
  } finally {
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
