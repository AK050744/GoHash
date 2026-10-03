import { getNotaryContract } from '../config/blockchain'

export interface VerificationResult {
  exists:      boolean
  owner?:      string
  notary?:     string
  timestamp?:  number
  ipfsCid?:    string
}

export class BlockchainService {
  /**
   * Submit a document hash to the on-chain Notary contract.
   */
  static async notarize(
    documentHash: string,
    description: string
  ): Promise<{ txHash: string; blockNumber: number }> {
    const contract = getNotaryContract()
    const bytes32  = documentHash.startsWith('0x') ? documentHash : `0x${documentHash}`

    const tx      = await contract.notarize(bytes32, description)
    const receipt = await tx.wait()

    return { txHash: receipt.hash, blockNumber: receipt.blockNumber }
  }

  /**
   * Verify a document hash on-chain.
   */
  static async verify(documentHash: string): Promise<VerificationResult> {
    const contract = getNotaryContract()
    const bytes32  = documentHash.startsWith('0x') ? documentHash : `0x${documentHash}`

    const onChain = await contract.exists(bytes32)
    if (!onChain) return { exists: false }

    // Day-02 verify() returns: (address owner, address notary, uint256 timestamp, string ipfsCid)
    const [owner, notary, timestamp, ipfsCid] = await contract.verify(bytes32)
    return {
      exists:    true,
      owner,
      notary,
      timestamp: Number(timestamp),
      ipfsCid,
    }
  }
}
