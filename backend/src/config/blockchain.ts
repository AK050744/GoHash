import { ethers } from 'ethers'
import { env } from './env'

// Minimal ABI — only the functions the backend needs to call
const NOTARY_ABI = [
  'function addNotary(address notary) external',
  'function removeNotary(address notary) external',
  'function isNotary(address notary) external view returns (bool)',
  'function notarize(bytes32 documentHash, string calldata ipfsCid, address owner) external',
  'function getDocument(bytes32 documentHash) external view returns (bytes32, string, address, address, uint256)',
  'function verify(bytes32 documentHash) external view returns (address owner, address notary, uint256 timestamp, string ipfsCid)',
  'function exists(bytes32 documentHash) external view returns (bool)',
  'function getDocumentsByOwner(address owner) external view returns (bytes32[])',
  'event DocumentNotarized(bytes32 indexed documentHash, string ipfsCid, address indexed owner, address indexed notary, uint256 timestamp)',
  'event NotaryAdded(address indexed notary, address indexed addedBy)',
  'event NotaryRemoved(address indexed notary, address indexed removedBy)',
]

let _provider: ethers.JsonRpcProvider | null = null
let _signer: ethers.Wallet | null = null
let _contract: ethers.Contract | null = null

export function getProvider(): ethers.JsonRpcProvider {
  if (!_provider) {
    _provider = new ethers.JsonRpcProvider(env.CHAIN_RPC_URL)
  }
  return _provider
}

export function getSigner(): ethers.Wallet {
  if (!_signer) {
    _signer = new ethers.Wallet(env.DEPLOYER_PRIVATE_KEY, getProvider())
  }
  return _signer
}

export function getNotaryContract(): ethers.Contract {
  if (!_contract) {
    _contract = new ethers.Contract(env.NOTARY_CONTRACT_ADDRESS, NOTARY_ABI, getSigner())
  }
  return _contract
}
