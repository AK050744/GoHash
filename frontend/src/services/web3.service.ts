import { BrowserProvider, Contract } from 'ethers'

const NOTARY_ABI = [
  'function notarize(bytes32 documentHash, string calldata description) external',
  'function verify(bytes32 documentHash) external view returns (address owner, uint256 timestamp, string description)',
  'function exists(bytes32 documentHash) external view returns (bool)',
  'function getMyDocuments() external view returns (bytes32[])',
]

export async function getProvider(): Promise<BrowserProvider> {
  if (!window.ethereum) {
    throw new Error('MetaMask is not installed. Please install MetaMask to continue.')
  }
  return new BrowserProvider(window.ethereum)
}

export async function connectWallet(): Promise<string> {
  const provider = await getProvider()
  const accounts = await provider.send('eth_requestAccounts', [])
  return accounts[0] as string
}

export async function getNotaryContract(): Promise<Contract> {
  const provider = await getProvider()
  const signer   = await provider.getSigner()
  const address  = import.meta.env.VITE_NOTARY_CONTRACT_ADDRESS as string

  if (!address || address === '0x0000000000000000000000000000000000000000') {
    throw new Error('Contract address not configured. Set VITE_NOTARY_CONTRACT_ADDRESS in .env')
  }

  return new Contract(address, NOTARY_ABI, signer)
}

/**
 * Compute a SHA-256 hash of a File object using the Web Crypto API.
 * Returns a hex string (without 0x prefix).
 */
export async function hashFile(file: File): Promise<string> {
  const buffer = await file.arrayBuffer()
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer)
  const hashArray  = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
}
