import { expect } from 'chai'
import { ethers } from 'hardhat'
import { DocumentNotary } from '../typechain-types'

describe('DocumentNotary', function () {
  let notary: DocumentNotary
  let ownerAddress: string

  // A fake SHA-256 hash represented as bytes32
  const SAMPLE_HASH = ethers.keccak256(ethers.toUtf8Bytes('sample-document-content'))

  beforeEach(async () => {
    const [owner] = await ethers.getSigners()
    ownerAddress = owner.address

    const Factory = await ethers.getContractFactory('DocumentNotary')
    notary = (await Factory.deploy()) as DocumentNotary
    await notary.waitForDeployment()
  })

  it('should notarize a document and emit an event', async () => {
    await expect(notary.notarize(SAMPLE_HASH, 'Test Document'))
      .to.emit(notary, 'DocumentNotarized')
      .withArgs(SAMPLE_HASH, ownerAddress, await getTimestamp(), 'Test Document')
  })

  it('should report a notarized document as existing', async () => {
    await notary.notarize(SAMPLE_HASH, 'Test Document')
    expect(await notary.exists(SAMPLE_HASH)).to.equal(true)
  })

  it('should return correct owner and description on verify()', async () => {
    await notary.notarize(SAMPLE_HASH, 'My Contract')
    const [owner, , description] = await notary.verify(SAMPLE_HASH)
    expect(owner).to.equal(ownerAddress)
    expect(description).to.equal('My Contract')
  })

  it('should revert when notarizing the same hash twice', async () => {
    await notary.notarize(SAMPLE_HASH, 'First')
    await expect(notary.notarize(SAMPLE_HASH, 'Second')).to.be.revertedWithCustomError(
      notary,
      'DocumentAlreadyNotarized'
    )
  })

  it('should revert when verifying a non-existent hash', async () => {
    const fakeHash = ethers.keccak256(ethers.toUtf8Bytes('nonexistent'))
    await expect(notary.verify(fakeHash)).to.be.revertedWithCustomError(
      notary,
      'DocumentNotFound'
    )
  })

  it('should revert on zero hash', async () => {
    await expect(notary.notarize(ethers.ZeroHash, 'Invalid')).to.be.revertedWithCustomError(
      notary,
      'InvalidHash'
    )
  })

  it('should track documents per owner', async () => {
    const hash2 = ethers.keccak256(ethers.toUtf8Bytes('second-doc'))
    await notary.notarize(SAMPLE_HASH, 'Doc 1')
    await notary.notarize(hash2, 'Doc 2')

    const docs = await notary.getMyDocuments()
    expect(docs.length).to.equal(2)
    expect(docs).to.include(SAMPLE_HASH)
    expect(docs).to.include(hash2)
  })
})

async function getTimestamp(): Promise<number> {
  const block = await ethers.provider.getBlock('latest')
  return block!.timestamp
}
