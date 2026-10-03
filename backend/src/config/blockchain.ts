import { ethers } from 'ethers'
import { env } from './env'

// Minimal ABI — only the functions the backend needs to call
const NOTARY_ABI = [
  'function notarize(bytes32 documentHash, string calldata description) external',
  'function verify(bytes32 documentHash) external view returns (address owner, uint256 timestamp, string description)',
  'function exists(bytes32 documentHash) external view returns (bool)',
  'function getDocumentsByOwner(address owner) external view returns (bytes32[])',
  'event DocumentNotarized(bytes32 indexed documentHash, address indexed owner, uint256 timestamp, string description)',
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
