import { ethers } from 'hardhat'

async function main() {
  const [deployer, firstNotary] = await ethers.getSigners()

  console.log('═══════════════════════════════════════════════════════')
  console.log('  GoHash — DocumentNotary Deployment')
  console.log('═══════════════════════════════════════════════════════')
  console.log('Deployer (contract owner):', deployer.address)
  console.log(
    'Deployer balance:',
    ethers.formatEther(await ethers.provider.getBalance(deployer.address)),
    'ETH'
  )

  // Deploy
  const DocumentNotary = await ethers.getContractFactory('DocumentNotary')
  const notary = await DocumentNotary.connect(deployer).deploy()
  await notary.waitForDeployment()

  const address = await notary.getAddress()
  console.log('\n✅ DocumentNotary deployed to:', address)

  // On localhost, auto-authorize the second signer as an initial notary
  // (useful for quick testing — remove or adapt for testnet/mainnet)
  if (firstNotary) {
    await notary.connect(deployer).addNotary(firstNotary.address)
    console.log('✅ Authorized initial notary:', firstNotary.address)
  }

  console.log('\n─── Environment Variables ─────────────────────────────')
  console.log('Add these to your backend .env:')
  console.log(`  NOTARY_CONTRACT_ADDRESS=${address}`)
  console.log('\nAdd these to your frontend .env:')
  console.log(`  VITE_NOTARY_CONTRACT_ADDRESS=${address}`)
  console.log('═══════════════════════════════════════════════════════\n')
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
