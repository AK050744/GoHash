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
 * Usage:
 *   npx hardhat node                                             (terminal 1)
 *   npx hardhat run scripts/deploy-local.ts --network localhost  (terminal 2)
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { ethers } from 'hardhat'

const SEPARATOR = '═'.repeat(57)
const THIN_SEP  = '─'.repeat(57)

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
  const contract = await Factory.connect(admin).deploy()
  await contract.waitForDeployment()

  const contractAddress = await contract.getAddress()
  console.log(`   Contract address : ${contractAddress}`)
  console.log(`   Deployer (owner) : ${admin.address}`)

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

  // ─── Environment output ──────────────────────────────────────────────────
  console.log(`\n${THIN_SEP}`)
  console.log('📋 Copy these into your .env files:\n')
  console.log('backend/.env')
  console.log(`  NOTARY_CONTRACT_ADDRESS=${contractAddress}`)
  console.log(`  CHAIN_RPC_URL=http://127.0.0.1:8545`)
  console.log(`  DEPLOYER_PRIVATE_KEY=<hardhat-account-0-private-key>`)
  console.log('\nfrontend/.env')
  console.log(`  VITE_NOTARY_CONTRACT_ADDRESS=${contractAddress}`)
  console.log(`${SEPARATOR}\n`)
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('\n❌ Deployment failed:', err)
    process.exit(1)
  })
