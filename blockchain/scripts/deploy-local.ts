/**
 * scripts/deploy-local.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Full local deployment script for the GoHash DocumentNotary contract.
 *
 * Signer layout (Hardhat default accounts):
 *   Index 0 — admin   : Contract owner; manages notary roles
 *   Index 1 — notary  : First authorized notary wallet
 *   Index 2 — user    : Document owner / end-user wallet
 *
 * After deploy this script:
 *   1. Authorizes the notary (signer index 1).
 *   2. Runs a smoke-test notarization.
 *   3. Writes blockchain/deployments/localhost.json with address, chainId, and ABI.
 *
 * Usage:
 *   npx hardhat node                                             (terminal 1)
 *   npx hardhat run scripts/deploy-local.ts --network localhost  (terminal 2)
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { ethers } from 'hardhat'
import fs from 'fs'
import path from 'path'
import type { DocumentNotary } from '../typechain-types'

const SEPARATOR = '═'.repeat(57)
const THIN_SEP  = '─'.repeat(57)

// Read-only ABI subset written to the deployment file (used by the backend)
const BACKEND_ABI = [
  'function isNotary(address notary) external view returns (bool)',
  'function getDocument(bytes32 documentHash) external view returns (bytes32, string, address, address, uint256)',
  'function verify(bytes32 documentHash) external view returns (address owner_, address notary_, uint256 timestamp_, string ipfsCid_)',
  'function exists(bytes32 documentHash) external view returns (bool)',
  'function getDocumentsByOwner(address owner) external view returns (bytes32[])',
  'event DocumentNotarized(bytes32 indexed documentHash, string ipfsCid, address indexed owner, address indexed notary, uint256 timestamp)',
  'event NotaryAdded(address indexed notary, address indexed addedBy)',
  'event NotaryRemoved(address indexed notary, address indexed removedBy)',
]

async function main() {
  const [admin, notary, user] = await ethers.getSigners()

  console.log(`\n${SEPARATOR}`)
  console.log('  GoHash — DocumentNotary Local Deployment')
  console.log(SEPARATOR)

  // ─── Account Summary ────────────────────────────────────────────────────
  const balances = await Promise.all([
    ethers.provider.getBalance(admin.address),
    ethers.provider.getBalance(notary.address),
    ethers.provider.getBalance(user.address),
  ])

  console.log('\n📋 Accounts')
  console.log(THIN_SEP)
  console.log(`  [admin]  ${admin.address}  (${ethers.formatEther(balances[0])} ETH)`)
  console.log(`  [notary] ${notary.address}  (${ethers.formatEther(balances[1])} ETH)`)
  console.log(`  [user]   ${user.address}  (${ethers.formatEther(balances[2])} ETH)`)

  // ─── Deploy ─────────────────────────────────────────────────────────────
  console.log('\n🚀 Deploying DocumentNotary…')
  const Factory = await ethers.getContractFactory('DocumentNotary')
  const contract = (await Factory.connect(admin).deploy()) as unknown as DocumentNotary
  await contract.waitForDeployment()

  const contractAddress = await contract.getAddress()
  const network = await ethers.provider.getNetwork()
  const chainId  = Number(network.chainId)

  console.log(`   Contract address : ${contractAddress}`)
  console.log(`   Deployer (owner) : ${admin.address}`)
  console.log(`   Chain ID         : ${chainId}`)

  // ─── Authorize Notary ────────────────────────────────────────────────────
  console.log('\n🔑 Authorizing notary wallet…')
  const tx = await contract.connect(admin).addNotary(notary.address)
  await tx.wait()
  console.log(`   Notary authorized: ${notary.address}`)
  console.log(`   isNotary check   : ${await contract.isNotary(notary.address)}`)

  // ─── Smoke-test notarization ─────────────────────────────────────────────
  console.log('\n📄 Smoke-test: notarizing a sample document…')
  const sampleHash = ethers.keccak256(ethers.toUtf8Bytes('smoke-test-document'))
  const sampleCid  = 'QmSmokePm8DxuNBHp6VhBGPQP1jZWNiWnXk1aDcUMDmsSCG'

  const notarizeTx = await contract.connect(notary).notarize(sampleHash, sampleCid, user.address)
  const receipt    = await notarizeTx.wait()

  console.log(`   Document hash : ${sampleHash}`)
  console.log(`   IPFS CID      : ${sampleCid}`)
  console.log(`   Owner         : ${user.address}`)
  console.log(`   Tx hash       : ${receipt?.hash}`)
  console.log(`   Block         : ${receipt?.blockNumber}`)

  // Verify it was stored
  const [, retCid, retOwner, retNotary] = await contract.getDocument(sampleHash)
  console.log(`\n   ✅ Verified on-chain:`)
  console.log(`      owner  = ${retOwner}`)
  console.log(`      notary = ${retNotary}`)
  console.log(`      CID    = ${retCid}`)

  // ─── Write deployment file ───────────────────────────────────────────────
  const deploymentsDir = path.join(__dirname, '..', 'deployments')
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir, { recursive: true })
  }

  const deploymentData = {
    address:  contractAddress,
    chainId,
    notaryAddress: notary.address,
    abi: BACKEND_ABI,
  }

  const outPath = path.join(deploymentsDir, 'localhost.json')
  fs.writeFileSync(outPath, JSON.stringify(deploymentData, null, 2))
  console.log(`\n📁 Deployment info written to: blockchain/deployments/localhost.json`)

  // ─── Environment output ──────────────────────────────────────────────────
  console.log(`\n${THIN_SEP}`)
  console.log('📋 Copy these into your .env files:\n')
  console.log('backend/.env')
  console.log(`  RPC_URL=http://127.0.0.1:8545`)
  console.log(`  CHAIN_ID=31337`)
  console.log(`  DEPLOYMENT_FILE=../blockchain/deployments/localhost.json`)
  console.log('\nfrontend/.env')
  console.log(`  VITE_NOTARY_CONTRACT_ADDRESS=${contractAddress}`)
  console.log(`  VITE_CHAIN_ID=31337`)
  console.log(`${SEPARATOR}\n`)
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('\n❌ Deployment failed:', err)
    process.exit(1)
  })
