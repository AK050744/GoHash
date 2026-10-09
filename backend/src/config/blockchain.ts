/**
 * config/blockchain.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Read-only blockchain access for the GoHash backend.
 *
 * SECURITY: The backend NEVER holds a private key or mnemonic.
 * The JsonRpcProvider is bound to a Contract with NO signer.
 * Only view functions (isNotary, getDocument, verify, exists) and
 * receipt decoding are permitted from this module.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { ethers } from 'ethers'
import fs from 'fs'
import path from 'path'
import { env } from './env'

// ─── ABI (read-only subset matching CONTRACT_INTERFACE.md) ──────────────────

export const NOTARY_ABI = [
  'function isNotary(address notary) external view returns (bool)',
  'function getDocument(bytes32 documentHash) external view returns (bytes32, string, address, address, uint256)',
  'function verify(bytes32 documentHash) external view returns (address owner_, address notary_, uint256 timestamp_, string ipfsCid_)',
  'function exists(bytes32 documentHash) external view returns (bool)',
  'function getDocumentsByOwner(address owner) external view returns (bytes32[])',
  'event DocumentNotarized(bytes32 indexed documentHash, string ipfsCid, address indexed owner, address indexed notary, uint256 timestamp)',
  'event NotaryAdded(address indexed notary, address indexed addedBy)',
  'event NotaryRemoved(address indexed notary, address indexed removedBy)',
]

// Full ABI matching CONTRACT_INTERFACE.md for client/testing contract runners
export const FULL_NOTARY_ABI = [
  ...NOTARY_ABI,
  'function contractOwner() external view returns (address)',
  'function notarize(bytes32 documentHash, string calldata ipfsCid, address owner) external',
  'function addNotary(address notary) external',
  'function removeNotary(address notary) external',
]

// ─── Deployment file loader ──────────────────────────────────────────────────

export interface DeploymentInfo {
  address: string
  chainId: number
  abi: string[]
}

const MISSING_DEPLOYMENT_MSG =
  'Contract not deployed. Run: cd blockchain; npx hardhat run scripts/deploy-local.ts --network localhost'

export function loadDeploymentInfo(): DeploymentInfo {
  // Resolve relative to backend/ working directory
  const filePath = path.resolve(process.cwd(), env.DEPLOYMENT_FILE)

  if (!fs.existsSync(filePath)) {
    throw new Error(MISSING_DEPLOYMENT_MSG)
  }

  try {
    const raw = fs.readFileSync(filePath, 'utf-8')
    const data = JSON.parse(raw) as DeploymentInfo
    if (!data.address || !data.chainId) {
      throw new Error('Malformed deployment file: missing address or chainId')
    }
    return data
  } catch (err: unknown) {
    if (err instanceof Error && err.message.includes('Malformed')) {
      throw err
    }
    throw new Error(MISSING_DEPLOYMENT_MSG)
  }
}

// ─── Provider singleton (read-only, no signer) ──────────────────────────────

let _provider: ethers.JsonRpcProvider | null = null

export function getProvider(): ethers.JsonRpcProvider {
  if (!_provider) {
    _provider = new ethers.JsonRpcProvider(env.RPC_URL)
  }
  return _provider
}

// ─── Contract factory (read-only, no signer) ─────────────────────────────────

export function getNotaryContract(): ethers.Contract {
  const deployment = loadDeploymentInfo()
  const provider   = getProvider()
  // No signer — provider only; all calls are read-only view calls
  return new ethers.Contract(deployment.address, NOTARY_ABI, provider)
}
