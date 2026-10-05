/**
 * scripts/accounts.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Displays local Hardhat test accounts with role mappings, addresses,
 * private keys, and on-chain balances.
 *
 * Usage:
 *   npx hardhat run scripts/accounts.ts
 *   npx hardhat run scripts/accounts.ts --network localhost
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { ethers } from 'hardhat'
import { TEST_ACCOUNTS } from '../test/helpers/accounts'

const SEPARATOR = '═'.repeat(64)
const THIN_SEP  = '─'.repeat(64)

async function main() {
  const signers = await ethers.getSigners()

  console.log(`\n${SEPARATOR}`)
  console.log('  GoHash — Hardhat Test Accounts & Role Mappings')
  console.log(SEPARATOR)

  for (const [key, info] of Object.entries(TEST_ACCOUNTS)) {
    const signer = signers[info.index]
    const balance = signer
      ? ethers.formatEther(await ethers.provider.getBalance(signer.address))
      : '0.0'

    console.log(`\n📌 [${key.toUpperCase()}] ${info.role}`)
    console.log(THIN_SEP)
    console.log(`  Index       : ${info.index}`)
    console.log(`  Address     : ${info.address}`)
    console.log(`  Private Key : ${info.privateKey}`)
    console.log(`  Balance     : ${balance} ETH`)
    console.log(`  Description : ${info.description}`)
  }

  console.log(`\n${SEPARATOR}`)
  console.log('📋 Usage in .env configurations:')
  console.log(THIN_SEP)
  console.log('backend/.env:')
  console.log(`  DEPLOYER_PRIVATE_KEY=${TEST_ACCOUNTS.admin.privateKey}`)
  console.log(`  ADMIN_WALLET_ADDRESS=${TEST_ACCOUNTS.admin.address}`)
  console.log(`  NOTARY_WALLET_ADDRESS=${TEST_ACCOUNTS.notary.address}`)
  console.log(`  CHAIN_RPC_URL=http://127.0.0.1:8545`)
  console.log(`${SEPARATOR}\n`)
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
