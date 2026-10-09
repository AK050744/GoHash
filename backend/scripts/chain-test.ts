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
 * ─────────────────────────────────────────────────────────────────────────────
 */

import http from 'http'
import crypto from 'crypto'
import mongoose from 'mongoose'
import { ethers } from 'ethers'
import app from '../src/app'
import { User } from '../src/models/User'
import { DocumentModel } from '../src/models/Document'
import { Notarization } from '../src/models/Notarization'
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
      const user2Email = `chain_user2_${Date.now()}@example.com`
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
    }

    console.log('\n--- Notarization Workflow Tests ---')

    // Set up actors for notarization workflow:
    // User A: Document owner (regular USER)
    const userAEmail = `user_a_${Date.now()}@example.com`
    const { token: userAToken, id: userAId } = await registerUser(userAEmail, 'User A')

    // Notary User: Certified notary (NOTARY role)
    const notaryEmail = `notary_${Date.now()}@example.com`
    const { token: notaryToken, id: notaryId } = await registerUser(notaryEmail, 'Notary Official')
    await User.updateOne({ _id: notaryId }, { role: 'NOTARY' })

    // User B: Independent third-party (regular USER)
    const userBEmail = `user_b_${Date.now()}@example.com`
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
    } catch (err) {
      logFail('approve: preconditions & return args', err)
    }

    // ── Test 11: real flow (notarize on-chain -> confirm -> CONFIRMED) ────────
    let realTxHash = ''
    try {
      const contractInfo = BlockchainService.getContractInfo()
      const contractAsNotary = new ethers.Contract(contractInfo.address, contractInfo.abi, signer1)

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
      const docDetailRes = await request(`/api/documents/${doc1._id.toString()}`, {
        headers: { Authorization: `Bearer ${userAToken}` },
      })

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
        notField.rejectionReason === null
      ) {
        logPass(
          'real flow: on-chain notarize -> confirm -> CONFIRMED',
          `txHash=${realTxHash.slice(0, 14)}..., block=${receipt.blockNumber}, status=NOTARIZED`
        )
      } else {
        throw new Error(`Document detail missing notarization: ${JSON.stringify(docDetailRes.data)}`)
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
      const contractInfo = BlockchainService.getContractInfo()
      const contractAsOwner = new ethers.Contract(contractInfo.address, contractInfo.abi, signer0)

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
      const contractAsSigner3 = new ethers.Contract(contractInfo.address, contractInfo.abi, signer3)
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
      const contractInfo = BlockchainService.getContractInfo()
      const contractAsNotary = new ethers.Contract(contractInfo.address, contractInfo.abi, signer1)

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
