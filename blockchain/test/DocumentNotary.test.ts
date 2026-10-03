import { expect } from 'chai'
import { ethers } from 'hardhat'
import { anyValue } from '@nomicfoundation/hardhat-chai-matchers/withArgs'
import { DocumentNotary } from '../typechain-types'
import { SignerWithAddress } from '@nomicfoundation/hardhat-ethers/signers'

describe('DocumentNotary', function () {
  let notary: DocumentNotary
  let owner: SignerWithAddress
  let notarySigner: SignerWithAddress
  let notarySigner2: SignerWithAddress
  let documentOwner: SignerWithAddress
  let stranger: SignerWithAddress

  // A fake SHA-256 hash represented as bytes32
  const SAMPLE_HASH = ethers.keccak256(ethers.toUtf8Bytes('sample-document-content'))
  const SAMPLE_CID  = 'QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG'

  beforeEach(async () => {
    ;[owner, notarySigner, notarySigner2, documentOwner, stranger] = await ethers.getSigners()

    const Factory = await ethers.getContractFactory('DocumentNotary')
    notary = (await Factory.connect(owner).deploy()) as DocumentNotary
    await notary.waitForDeployment()

    // Authorize the notary signer
    await notary.connect(owner).addNotary(notarySigner.address)
  })

  // ─── Access Control ────────────────────────────────────────────────────────

  describe('Notary management', function () {
    it('deployer is the contract owner', async () => {
      expect(await notary.contractOwner()).to.equal(owner.address)
    })

    it('owner can add a notary', async () => {
      await expect(notary.connect(owner).addNotary(notarySigner2.address))
        .to.emit(notary, 'NotaryAdded')
        .withArgs(notarySigner2.address, owner.address)

      expect(await notary.isNotary(notarySigner2.address)).to.equal(true)
    })

    it('owner can remove a notary', async () => {
      await expect(notary.connect(owner).removeNotary(notarySigner.address))
        .to.emit(notary, 'NotaryRemoved')
        .withArgs(notarySigner.address, owner.address)

      expect(await notary.isNotary(notarySigner.address)).to.equal(false)
    })

    it('non-owner cannot add a notary', async () => {
      await expect(
        notary.connect(stranger).addNotary(notarySigner2.address)
      ).to.be.revertedWithCustomError(notary, 'NotContractOwner')
    })

    it('non-owner cannot remove a notary', async () => {
      await expect(
        notary.connect(stranger).removeNotary(notarySigner.address)
      ).to.be.revertedWithCustomError(notary, 'NotContractOwner')
    })

    it('reverts when adding an already-authorized notary', async () => {
      await expect(
        notary.connect(owner).addNotary(notarySigner.address)
      ).to.be.revertedWithCustomError(notary, 'NotaryAlreadyAuthorized')
    })

    it('reverts when removing a non-notary address', async () => {
      await expect(
        notary.connect(owner).removeNotary(stranger.address)
      ).to.be.revertedWithCustomError(notary, 'NotaryNotFound')
    })

    it('reverts when adding the zero address as a notary', async () => {
      await expect(
        notary.connect(owner).addNotary(ethers.ZeroAddress)
      ).to.be.revertedWithCustomError(notary, 'InvalidAddress')
    })
  })

  // ─── Notarization ─────────────────────────────────────────────────────────

  describe('notarize()', function () {
    it('authorized notary can notarize a document and event is emitted', async () => {
      const tx = notary
        .connect(notarySigner)
        .notarize(SAMPLE_HASH, SAMPLE_CID, documentOwner.address)

      await expect(tx)
        .to.emit(notary, 'DocumentNotarized')
        .withArgs(
          SAMPLE_HASH,
          SAMPLE_CID,
          documentOwner.address,
          notarySigner.address,
          anyValue   // block.timestamp is non-deterministic; validate type not exact value
        )
    })

    it('unauthorized address cannot notarize', async () => {
      await expect(
        notary.connect(stranger).notarize(SAMPLE_HASH, SAMPLE_CID, documentOwner.address)
      ).to.be.revertedWithCustomError(notary, 'NotAuthorizedNotary')
    })

    it('reverts on zero document hash', async () => {
      await expect(
        notary.connect(notarySigner).notarize(ethers.ZeroHash, SAMPLE_CID, documentOwner.address)
      ).to.be.revertedWithCustomError(notary, 'InvalidHash')
    })

    it('reverts when owner address is zero', async () => {
      await expect(
        notary.connect(notarySigner).notarize(SAMPLE_HASH, SAMPLE_CID, ethers.ZeroAddress)
      ).to.be.revertedWithCustomError(notary, 'InvalidAddress')
    })

    it('reverts when notarizing the same hash twice', async () => {
      await notary.connect(notarySigner).notarize(SAMPLE_HASH, SAMPLE_CID, documentOwner.address)
      await expect(
        notary.connect(notarySigner).notarize(SAMPLE_HASH, SAMPLE_CID, documentOwner.address)
      ).to.be.revertedWithCustomError(notary, 'DocumentAlreadyNotarized')
    })

    it('revoked notary can no longer notarize', async () => {
      await notary.connect(owner).removeNotary(notarySigner.address)
      await expect(
        notary.connect(notarySigner).notarize(SAMPLE_HASH, SAMPLE_CID, documentOwner.address)
      ).to.be.revertedWithCustomError(notary, 'NotAuthorizedNotary')
    })
  })

  // ─── Retrieval & Verification ─────────────────────────────────────────────

  describe('getDocument() and verify()', function () {
    beforeEach(async () => {
      await notary.connect(notarySigner).notarize(SAMPLE_HASH, SAMPLE_CID, documentOwner.address)
    })

    it('exists() returns true for a notarized hash', async () => {
      expect(await notary.exists(SAMPLE_HASH)).to.equal(true)
    })

    it('exists() returns false for an unknown hash', async () => {
      const unknownHash = ethers.keccak256(ethers.toUtf8Bytes('unknown'))
      expect(await notary.exists(unknownHash)).to.equal(false)
    })

    it('getDocument() returns all fields correctly', async () => {
      const [hash, cid, docOwner, docNotary] = await notary.getDocument(SAMPLE_HASH)
      expect(hash).to.equal(SAMPLE_HASH)
      expect(cid).to.equal(SAMPLE_CID)
      expect(docOwner).to.equal(documentOwner.address)
      expect(docNotary).to.equal(notarySigner.address)
    })

    it('verify() returns owner, notary, timestamp and CID', async () => {
      const [docOwner, docNotary, , cid] = await notary.verify(SAMPLE_HASH)
      expect(docOwner).to.equal(documentOwner.address)
      expect(docNotary).to.equal(notarySigner.address)
      expect(cid).to.equal(SAMPLE_CID)
    })

    it('getDocument() reverts for an unknown hash', async () => {
      const fakeHash = ethers.keccak256(ethers.toUtf8Bytes('nonexistent'))
      await expect(notary.getDocument(fakeHash)).to.be.revertedWithCustomError(
        notary,
        'DocumentNotFound'
      )
    })

    it('verify() reverts for an unknown hash', async () => {
      const fakeHash = ethers.keccak256(ethers.toUtf8Bytes('nonexistent'))
      await expect(notary.verify(fakeHash)).to.be.revertedWithCustomError(
        notary,
        'DocumentNotFound'
      )
    })
  })

  // ─── Owner Document Tracking ──────────────────────────────────────────────

  describe('getDocumentsByOwner() / getMyDocuments()', function () {
    it('tracks all hashes for a given owner', async () => {
      const hash2 = ethers.keccak256(ethers.toUtf8Bytes('second-doc'))

      await notary.connect(notarySigner).notarize(SAMPLE_HASH, SAMPLE_CID, documentOwner.address)
      await notary.connect(notarySigner).notarize(hash2, SAMPLE_CID, documentOwner.address)

      const docs = await notary.getDocumentsByOwner(documentOwner.address)
      expect(docs.length).to.equal(2)
      expect(docs).to.include(SAMPLE_HASH)
      expect(docs).to.include(hash2)
    })

    it('getMyDocuments() returns hashes for the caller', async () => {
      await notary.connect(notarySigner).notarize(SAMPLE_HASH, SAMPLE_CID, documentOwner.address)

      // documentOwner calls getMyDocuments
      const docs = await notary.connect(documentOwner).getMyDocuments()
      expect(docs.length).to.equal(1)
      expect(docs[0]).to.equal(SAMPLE_HASH)
    })
  })
})
