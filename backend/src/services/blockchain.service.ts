/**
 * services/blockchain.service.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Read-only blockchain service for the GoHash backend.
 *
 * SECURITY: The backend NEVER holds a private key or mnemonic.
 * This service only reads state from the chain and decodes receipts.
 * All write operations (notarize) are performed by the notary's wallet
 * in the browser (MetaMask) and submitted via confirm endpoint.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { ethers } from 'ethers'
import { getProvider, getNotaryContract, loadDeploymentInfo, NOTARY_ABI } from '../config/blockchain'
import { ApiError } from '../utils/ApiError'

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ContractInfo {
  address: string
  chainId: number
  abi: string[]
}

export interface OnChainRecord {
  exists: boolean
  documentHash?: string
  ipfsCid?: string
  owner?: string
  notary?: string
  timestamp?: number
}

export interface ReceiptVerification {
  valid: boolean
  reason?: string
  blockNumber?: number
  notary?: string
  documentHash?: string
  timestamp?: number
}

// ─── BlockchainService ───────────────────────────────────────────────────────

export class BlockchainService {
  /**
   * Returns deployment info: address, chainId, and ABI.
   * Used by approve endpoint to build the response the frontend uses.
   * Throws 503 CONTRACT_NOT_DEPLOYED if the deployment file is missing.
   */
  static getContractInfo(): ContractInfo {
    try {
      const deployment = loadDeploymentInfo()
      return {
        address: deployment.address,
        chainId: deployment.chainId,
        abi: NOTARY_ABI,
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      if (msg.includes('not deployed') || msg.includes('DEPLOYMENT_FILE') || msg.includes('Malformed')) {
        throw new ApiError(
          503,
          'CONTRACT_NOT_DEPLOYED',
          'Contract not deployed. Run: cd blockchain; npx hardhat run scripts/deploy-local.ts --network localhost'
        )
      }
      throw err
    }
  }

  /**
   * Query on-chain record for a document hash.
   * Returns { exists: false } if the document is not notarized.
   * Never reverts on "not found".
   * Throws 503 CONTRACT_NOT_DEPLOYED or 503 CHAIN_UNREACHABLE on infrastructure errors.
   */
  static async getRecord(sha256Hash: string): Promise<OnChainRecord> {
    try {
      const contract = getNotaryContract()
      const bytes32  = sha256Hash.startsWith('0x') ? sha256Hash : `0x${sha256Hash}`

      const onChain = await contract.exists(bytes32)
      if (!onChain) return { exists: false }

      const [documentHash_, ipfsCid_, owner_, notary_, timestamp_] =
        await contract.getDocument(bytes32)

      return {
        exists:       true,
        documentHash: documentHash_,
        ipfsCid:      ipfsCid_,
        owner:        owner_.toLowerCase(),
        notary:       notary_.toLowerCase(),
        timestamp:    Number(timestamp_),
      }
    } catch (err: unknown) {
      BlockchainService._rethrowInfraError(err)
      throw err
    }
  }

  /**
   * Check whether a wallet address is an authorized notary on-chain.
   * Throws 503 CONTRACT_NOT_DEPLOYED or 503 CHAIN_UNREACHABLE on infrastructure errors.
   */
  static async isNotaryAuthorized(walletAddress: string): Promise<boolean> {
    try {
      const contract = getNotaryContract()
      return contract.isNotary(walletAddress)
    } catch (err: unknown) {
      BlockchainService._rethrowInfraError(err)
      throw err
    }
  }

  /**
   * Verify a transaction receipt against expected values.
   *
   * Checks ALL of the following:
   *   1. Transaction is mined (not pending).
   *   2. receipt.status === 1 (success).
   *   3. receipt.to matches the contract address.
   *   4. tx.chainId (or provider network chainId) matches expected chainId.
   *   5. tx.from matches the expected notary wallet.
   *   6. The DocumentNotarized event is present with the expected documentHash and notary.
   *
   * Returns { valid: false, reason } on any mismatch.
   * Returns { valid: true, blockNumber, notary, documentHash, timestamp } on success.
   */
  static async verifyReceipt(
    txHash: string,
    expected: {
      contractAddress: string
      chainId: number
      notaryWallet: string
      documentHash: string // 64-char hex (no 0x)
    }
  ): Promise<ReceiptVerification> {
    const provider = getProvider()

    // Fetch the transaction itself first to verify existence on chain
    const tx = await provider.getTransaction(txHash)
    if (!tx) {
      return { valid: false, reason: 'TX_NOT_FOUND: Transaction not found on chain' }
    }

    // Fetch receipt (null = not yet mined)
    const receipt = await provider.getTransactionReceipt(txHash)
    if (!receipt) {
      return { valid: false, reason: 'TX_PENDING' }
    }

    // Check success
    if (receipt.status !== 1) {
      return { valid: false, reason: 'TX_REVERTED' }
    }

    // Check destination address
    const expectedAddr = expected.contractAddress.toLowerCase()
    const receiptTo    = (receipt.to ?? '').toLowerCase()
    if (receiptTo !== expectedAddr) {
      return {
        valid:  false,
        reason: `WRONG_CONTRACT: receipt.to=${receiptTo}, expected=${expectedAddr}`,
      }
    }

    // Verify sender matches the notary's linked wallet
    const txFrom         = (tx.from ?? '').toLowerCase()
    const expectedNotary = expected.notaryWallet.toLowerCase()
    if (txFrom !== expectedNotary) {
      return {
        valid:  false,
        reason: `WRONG_SIGNER: tx.from=${txFrom}, expected notary=${expectedNotary}`,
      }
    }

    // Verify chain ID
    const network        = await provider.getNetwork()
    const actualChainId  = Number(network.chainId)
    if (actualChainId !== expected.chainId) {
      return {
        valid:  false,
        reason: `WRONG_CHAIN: got=${actualChainId}, expected=${expected.chainId}`,
      }
    }

    // Decode the DocumentNotarized event from the receipt
    const iface = new ethers.Interface(NOTARY_ABI)
    const expectedBytes32 = `0x${expected.documentHash}`

    let foundEvent: { documentHash: string; notary: string; timestamp: number } | null = null

    for (const log of receipt.logs) {
      try {
        const parsed = iface.parseLog({ topics: [...log.topics], data: log.data })
        if (parsed && parsed.name === 'DocumentNotarized') {
          foundEvent = {
            documentHash: (parsed.args[0] as string).toLowerCase(),
            notary:       (parsed.args[3] as string).toLowerCase(),
            timestamp:    Number(parsed.args[4]),
          }
          break
        }
      } catch {
        // Not a matching log — continue
      }
    }

    if (!foundEvent) {
      return { valid: false, reason: 'EVENT_NOT_FOUND: DocumentNotarized event missing from receipt' }
    }

    // Verify the event's documentHash
    if (foundEvent.documentHash !== expectedBytes32.toLowerCase()) {
      return {
        valid:  false,
        reason: `WRONG_HASH: event.documentHash=${foundEvent.documentHash}, expected=${expectedBytes32.toLowerCase()}`,
      }
    }

    // Verify the event's notary matches the linked wallet
    if (foundEvent.notary !== expectedNotary) {
      return {
        valid:  false,
        reason: `WRONG_EVENT_NOTARY: event.notary=${foundEvent.notary}, expected=${expectedNotary}`,
      }
    }

    // Read on-chain timestamp from block: proves the hash was recorded no later than this time
    let blockTimestamp = foundEvent.timestamp
    if (receipt.blockNumber) {
      try {
        const block = await provider.getBlock(receipt.blockNumber)
        if (block) {
          blockTimestamp = block.timestamp
        }
      } catch {
        // Fallback to event block timestamp if block fetch is unavailable
      }
    }

    return {
      valid:        true,
      blockNumber:  receipt.blockNumber,
      notary:       foundEvent.notary,
      documentHash: foundEvent.documentHash,
      timestamp:    blockTimestamp,
    }
  }

  /**
   * Inspect an unknown error from a blockchain call and re-throw it as an ApiError
   * with an appropriate 503 code, or return (allowing the caller to re-throw the
   * original error if no infrastructure match is found).
   *
   *  • "not deployed" / "DEPLOYMENT_FILE" / "Malformed"  → 503 CONTRACT_NOT_DEPLOYED
   *  • ECONNREFUSED / ENOTFOUND / ERR_SOCKET / timeout   → 503 CHAIN_UNREACHABLE
   */
  private static _rethrowInfraError(err: unknown): never | void {
    const msg = err instanceof Error ? err.message : String(err)

    if (
      msg.includes('not deployed') ||
      msg.includes('DEPLOYMENT_FILE') ||
      msg.includes('Malformed deployment')
    ) {
      throw new ApiError(
        503,
        'CONTRACT_NOT_DEPLOYED',
        'Contract not deployed. Run: cd blockchain; npx hardhat run scripts/deploy-local.ts --network localhost'
      )
    }

    if (
      msg.includes('ECONNREFUSED') ||
      msg.includes('ENOTFOUND') ||
      msg.includes('ERR_SOCKET') ||
      msg.includes('network timeout') ||
      msg.includes('could not detect network') ||
      msg.includes('connection refused')
    ) {
      throw new ApiError(
        503,
        'CHAIN_UNREACHABLE',
        `Blockchain node unreachable at ${process.env.RPC_URL ?? 'configured RPC_URL'}. Start the Hardhat node: cd blockchain; npx hardhat node`
      )
    }
    // Not an infra error — let caller re-throw the original
  }
}

