import { ethers } from 'hardhat'

async function main() {
  const [deployer] = await ethers.getSigners()

  console.log('Deploying DocumentNotary with account:', deployer.address)
  console.log(
    'Account balance:',
    (await ethers.provider.getBalance(deployer.address)).toString()
  )

  const DocumentNotary = await ethers.getContractFactory('DocumentNotary')
  const notary = await DocumentNotary.deploy()

  await notary.waitForDeployment()

  const address = await notary.getAddress()
  console.log('DocumentNotary deployed to:', address)
  console.log('')
  console.log('Update your backend .env with:')
  console.log(`NOTARY_CONTRACT_ADDRESS=${address}`)
  console.log('')
  console.log('Update your frontend .env with:')
  console.log(`VITE_NOTARY_CONTRACT_ADDRESS=${address}`)
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
