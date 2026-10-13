import { ethers } from 'ethers'
import { loadDeploymentInfo, FULL_NOTARY_ABI } from './src/config/blockchain'
import { env } from './src/config/env'

async function check() {
  const provider = new ethers.JsonRpcProvider(env.RPC_URL)
  const dep = loadDeploymentInfo()
  const contract = new ethers.Contract(dep.address, FULL_NOTARY_ABI, provider)
  const signer0 = await provider.getSigner(0)
  const signer1 = await provider.getSigner(1)
  const s0Addr = await signer0.getAddress()
  const s1Addr = await signer1.getAddress()
  console.log('Contract address:', dep.address)
  console.log('Signer 0:', s0Addr)
  console.log('Signer 1:', s1Addr)
  console.log('isNotary(signer0):', await contract.isNotary(s0Addr))
  console.log('isNotary(signer1):', await contract.isNotary(s1Addr))
}
check()
