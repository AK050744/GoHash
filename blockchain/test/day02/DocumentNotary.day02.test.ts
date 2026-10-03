/**
 * Day 02 — DocumentNotary: Access Control, IPFS CID & Full Retrieval Tests
 * ─────────────────────────────────────────────────────────────────────────────
 * Scope: All new features implemented on Day 02.
 *
 * What was built on Day 02:
 *  • Two-tier access control
 *      - contractOwner  → set to deployer; manages authorized notaries
 *      - Notary role    → only authorized wallets may call notarize()
 *  • addNotary(address)    — owner-only; emits NotaryAdded
 *  • removeNotary(address) — owner-only; emits NotaryRemoved
 *  • isNotary(address)     — public read; returns authorization status
 *  • notarize() upgraded
 *      - now requires onlyNotary modifier
 *      - accepts ipfsCid (string) parameter
 *      - accepts separate owner address parameter
 *      - records notary address alongside owner
 *  • getDocument(bytes32)  — returns full 5-field record
 *  • verify(bytes32)       — returns (owner, notary, timestamp, ipfsCid)
 *  • New custom errors:
 *      NotContractOwner, NotAuthorizedNotary, NotaryAlreadyAuthorized,
 *      NotaryNotFound, InvalidAddress
 *  • New events: NotaryAdded, NotaryRemoved
 *  • Updated event: DocumentNotarized now includes ipfsCid and notary address
 *
 * Run:  npx hardhat test test/day02/DocumentNotary.day02.test.ts
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { expect } from 'chai'
import { ethers } from 'hardhat'
import { anyValue } from '@nomicfoundation/hardhat-chai-matchers/withArgs'
import { DocumentNotary } from '../../typechain-types'
import { SignerWithAddress } from '@nomicfoundation/hardhat-ethers/signers'

describe('[Day 02] DocumentNotary — Access Control, IPFS CID & Retrieval', function () {
  let notary: DocumentNotary
  let owner: SignerWithAddress        // contract deployer / contract owner
  let notarySigner: SignerWithAddress // authorized notary wallet
  let notarySigner2: SignerWithAddress
  let documentOwner: SignerWithAddress // wallet that "owns" a document
  let stranger: SignerWithAddress      // unauthorized wallet

  // Simulated SHA-256 document hash (bytes32)
  const SAMPLE_HASH = ethers.keccak256(ethers.toUtf8Bytes('sample-document-content'))
  // Sample IPFS CIDv0
  const SAMPLE_CID  = 'QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG'
  // A second distinct hash
  const HASH_2      = ethers.keccak256(ethers.toUtf8Bytes('second-document-content'))

  beforeEach(async () => {
    ;[owner, notarySigner, notarySigner2, documentOwner, stranger] = await ethers.getSigners()

    const Factory = await ethers.getContractFactory('DocumentNotary')
    notary = (await Factory.connect(owner).deploy()) as DocumentNotary
    await notary.waitForDeployment()

    // Pre-authorize the primary notary signer
    await notary.connect(owner).addNotary(notarySigner.address)
  })

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTION 1 — Contract Ownership
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Contract Ownership', function () {
    it('deployer address is stored as contractOwner', async () => {
      expect(await notary.contractOwner()).to.equal(owner.address)
    })

    it('contractOwner is immutable — re-deploy changes it', async () => {
      // Deploy a fresh instance with a different deployer
      const [, , , , , newOwner] = await ethers.getSigners()
      const Factory = await ethers.getContractFactory('DocumentNotary')
      const freshNotary = (await Factory.connect(newOwner).deploy()) as DocumentNotary
      await freshNotary.waitForDeployment()
      expect(await freshNotary.contractOwner()).to.equal(newOwner.address)
    })
  })

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTION 2 — Notary Management (addNotary / removeNotary / isNotary)
  // ═══════════════════════════════════════════════════════════════════════════

  describe('addNotary()', function () {
    it('owner can authorize a new notary address', async () => {
      await notary.connect(owner).addNotary(notarySigner2.address)
      expect(await notary.isNotary(notarySigner2.address)).to.equal(true)
    })

    it('addNotary() emits NotaryAdded with correct arguments', async () => {
      await expect(notary.connect(owner).addNotary(notarySigner2.address))
        .to.emit(notary, 'NotaryAdded')
        .withArgs(notarySigner2.address, owner.address)
    })

    it('reverts with NotContractOwner when a non-owner calls addNotary()', async () => {
      await expect(
        notary.connect(stranger).addNotary(notarySigner2.address)
      ).to.be.revertedWithCustomError(notary, 'NotContractOwner')
    })

    it('reverts with NotContractOwner when a notary calls addNotary()', async () => {
      // Even an authorized notary cannot manage other notaries
      await expect(
        notary.connect(notarySigner).addNotary(notarySigner2.address)
      ).to.be.revertedWithCustomError(notary, 'NotContractOwner')
    })

    it('reverts with NotaryAlreadyAuthorized when adding a duplicate notary', async () => {
      await expect(
        notary.connect(owner).addNotary(notarySigner.address)
      ).to.be.revertedWithCustomError(notary, 'NotaryAlreadyAuthorized')
    })

    it('reverts with InvalidAddress when adding the zero address', async () => {
      await expect(
        notary.connect(owner).addNotary(ethers.ZeroAddress)
      ).to.be.revertedWithCustomError(notary, 'InvalidAddress')
    })

    it('isNotary() returns false for a wallet that was never added', async () => {
      expect(await notary.isNotary(stranger.address)).to.equal(false)
    })
  })

  describe('removeNotary()', function () {
    it('owner can revoke an authorized notary', async () => {
      await notary.connect(owner).removeNotary(notarySigner.address)
      expect(await notary.isNotary(notarySigner.address)).to.equal(false)
    })

    it('removeNotary() emits NotaryRemoved with correct arguments', async () => {
      await expect(notary.connect(owner).removeNotary(notarySigner.address))
        .to.emit(notary, 'NotaryRemoved')
        .withArgs(notarySigner.address, owner.address)
    })

    it('reverts with NotContractOwner when a non-owner calls removeNotary()', async () => {
      await expect(
        notary.connect(stranger).removeNotary(notarySigner.address)
      ).to.be.revertedWithCustomError(notary, 'NotContractOwner')
    })

    it('reverts with NotaryNotFound when removing an address that is not a notary', async () => {
      await expect(
        notary.connect(owner).removeNotary(stranger.address)
      ).to.be.revertedWithCustomError(notary, 'NotaryNotFound')
    })

    it('reverts with InvalidAddress when removing the zero address', async () => {
      await expect(
        notary.connect(owner).removeNotary(ethers.ZeroAddress)
      ).to.be.revertedWithCustomError(notary, 'InvalidAddress')
    })

    it('notary can be re-authorized after being removed', async () => {
      await notary.connect(owner).removeNotary(notarySigner.address)
      expect(await notary.isNotary(notarySigner.address)).to.equal(false)

      await notary.connect(owner).addNotary(notarySigner.address)
      expect(await notary.isNotary(notarySigner.address)).to.equal(true)
    })
  })

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTION 3 — notarize() with Notary Role & IPFS CID
  // ═══════════════════════════════════════════════════════════════════════════

  describe('notarize()', function () {
    it('authorized notary can successfully notarize a document', async () => {
      await expect(
        notary.connect(notarySigner).notarize(SAMPLE_HASH, SAMPLE_CID, documentOwner.address)
      ).to.not.be.reverted
    })

    it('notarize() emits DocumentNotarized with correct arguments', async () => {
      await expect(
        notary.connect(notarySigner).notarize(SAMPLE_HASH, SAMPLE_CID, documentOwner.address)
      )
        .to.emit(notary, 'DocumentNotarized')
        .withArgs(
          SAMPLE_HASH,
          SAMPLE_CID,
          documentOwner.address,
          notarySigner.address,
          anyValue // block.timestamp — validated by EVM, not predicted in tests
        )
    })

    it('DocumentNotarized event records notary address separately from owner', async () => {
      // Verify the notary (msg.sender) and document owner are distinct in the event
      const tx = await notary
        .connect(notarySigner)
        .notarize(SAMPLE_HASH, SAMPLE_CID, documentOwner.address)
      const receipt = await tx.wait()
      const event = receipt?.logs.find(
        (log) => notary.interface.parseLog(log as any)?.name === 'DocumentNotarized'
      )
      const parsed = notary.interface.parseLog(event as any)
      expect(parsed?.args.notary).to.equal(notarySigner.address)
      expect(parsed?.args.owner).to.equal(documentOwner.address)
      expect(parsed?.args.notary).to.not.equal(parsed?.args.owner)
    })

    it('IPFS CID is stored correctly and retrievable', async () => {
      await notary.connect(notarySigner).notarize(SAMPLE_HASH, SAMPLE_CID, documentOwner.address)
      const [, cid] = await notary.getDocument(SAMPLE_HASH)
      expect(cid).to.equal(SAMPLE_CID)
    })

    it('notarize() works with an empty IPFS CID (optional field)', async () => {
      await expect(
        notary.connect(notarySigner).notarize(SAMPLE_HASH, '', documentOwner.address)
      ).to.not.be.reverted
    })

    it('reverts with NotAuthorizedNotary when a stranger calls notarize()', async () => {
      await expect(
        notary.connect(stranger).notarize(SAMPLE_HASH, SAMPLE_CID, documentOwner.address)
      ).to.be.revertedWithCustomError(notary, 'NotAuthorizedNotary')
    })

    it('reverts with NotAuthorizedNotary when the contract owner calls notarize() without notary role', async () => {
      // Owner is not automatically a notary
      await expect(
        notary.connect(owner).notarize(SAMPLE_HASH, SAMPLE_CID, documentOwner.address)
      ).to.be.revertedWithCustomError(notary, 'NotAuthorizedNotary')
    })

    it('reverts with NotAuthorizedNotary after a notary is revoked', async () => {
      await notary.connect(owner).removeNotary(notarySigner.address)
      await expect(
        notary.connect(notarySigner).notarize(SAMPLE_HASH, SAMPLE_CID, documentOwner.address)
      ).to.be.revertedWithCustomError(notary, 'NotAuthorizedNotary')
    })

    it('reverts with InvalidHash on a zero document hash', async () => {
      await expect(
        notary.connect(notarySigner).notarize(ethers.ZeroHash, SAMPLE_CID, documentOwner.address)
      ).to.be.revertedWithCustomError(notary, 'InvalidHash')
    })

    it('reverts with InvalidAddress when owner is the zero address', async () => {
      await expect(
        notary.connect(notarySigner).notarize(SAMPLE_HASH, SAMPLE_CID, ethers.ZeroAddress)
      ).to.be.revertedWithCustomError(notary, 'InvalidAddress')
    })

    it('reverts with DocumentAlreadyNotarized on a duplicate hash', async () => {
      await notary.connect(notarySigner).notarize(SAMPLE_HASH, SAMPLE_CID, documentOwner.address)
      await expect(
        notary.connect(notarySigner).notarize(SAMPLE_HASH, SAMPLE_CID, documentOwner.address)
      ).to.be.revertedWithCustomError(notary, 'DocumentAlreadyNotarized')
    })

    it('two different hashes can both be notarized successfully', async () => {
      await expect(
        notary.connect(notarySigner).notarize(SAMPLE_HASH, SAMPLE_CID, documentOwner.address)
      ).to.not.be.reverted

      await expect(
        notary.connect(notarySigner).notarize(HASH_2, SAMPLE_CID, documentOwner.address)
      ).to.not.be.reverted
    })

    it('multiple notaries can notarize different documents independently', async () => {
      await notary.connect(owner).addNotary(notarySigner2.address)

      await expect(
        notary.connect(notarySigner).notarize(SAMPLE_HASH, SAMPLE_CID, documentOwner.address)
      ).to.not.be.reverted

      await expect(
        notary.connect(notarySigner2).notarize(HASH_2, SAMPLE_CID, documentOwner.address)
      ).to.not.be.reverted
    })
  })

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTION 4 — getDocument() Full Retrieval
  // ═══════════════════════════════════════════════════════════════════════════

  describe('getDocument()', function () {
    beforeEach(async () => {
      await notary.connect(notarySigner).notarize(SAMPLE_HASH, SAMPLE_CID, documentOwner.address)
    })

    it('returns the document hash field correctly', async () => {
      const [hash] = await notary.getDocument(SAMPLE_HASH)
      expect(hash).to.equal(SAMPLE_HASH)
    })

    it('returns the IPFS CID field correctly', async () => {
      const [, cid] = await notary.getDocument(SAMPLE_HASH)
      expect(cid).to.equal(SAMPLE_CID)
    })

    it('returns the document owner address correctly', async () => {
      const [, , docOwner] = await notary.getDocument(SAMPLE_HASH)
      expect(docOwner).to.equal(documentOwner.address)
    })

    it('returns the notary address correctly', async () => {
      const [, , , docNotary] = await notary.getDocument(SAMPLE_HASH)
      expect(docNotary).to.equal(notarySigner.address)
    })

    it('returns a non-zero timestamp', async () => {
      const [, , , , timestamp] = await notary.getDocument(SAMPLE_HASH)
      expect(timestamp).to.be.greaterThan(0n)
    })

    it('notary address and document owner address are stored as separate fields', async () => {
      const [, , docOwner, docNotary] = await notary.getDocument(SAMPLE_HASH)
      expect(docOwner).to.equal(documentOwner.address)
      expect(docNotary).to.equal(notarySigner.address)
      expect(docOwner).to.not.equal(docNotary)
    })

    it('reverts with DocumentNotFound for an unknown hash', async () => {
      const fakeHash = ethers.keccak256(ethers.toUtf8Bytes('nonexistent'))
      await expect(notary.getDocument(fakeHash)).to.be.revertedWithCustomError(
        notary,
        'DocumentNotFound'
      )
    })
  })

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTION 5 — verify() Function
  // ═══════════════════════════════════════════════════════════════════════════

  describe('verify()', function () {
    beforeEach(async () => {
      await notary.connect(notarySigner).notarize(SAMPLE_HASH, SAMPLE_CID, documentOwner.address)
    })

    it('returns the document owner address', async () => {
      const [docOwner] = await notary.verify(SAMPLE_HASH)
      expect(docOwner).to.equal(documentOwner.address)
    })

    it('returns the notary address', async () => {
      const [, docNotary] = await notary.verify(SAMPLE_HASH)
      expect(docNotary).to.equal(notarySigner.address)
    })

    it('returns a non-zero timestamp', async () => {
      const [, , timestamp] = await notary.verify(SAMPLE_HASH)
      expect(timestamp).to.be.greaterThan(0n)
    })

    it('returns the IPFS CID', async () => {
      const [, , , cid] = await notary.verify(SAMPLE_HASH)
      expect(cid).to.equal(SAMPLE_CID)
    })

    it('reverts with DocumentNotFound for an unknown hash', async () => {
      const fakeHash = ethers.keccak256(ethers.toUtf8Bytes('nonexistent'))
      await expect(notary.verify(fakeHash)).to.be.revertedWithCustomError(
        notary,
        'DocumentNotFound'
      )
    })
  })

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTION 6 — exists() Boolean Check
  // ═══════════════════════════════════════════════════════════════════════════

  describe('exists()', function () {
    it('returns true after a document has been notarized', async () => {
      await notary.connect(notarySigner).notarize(SAMPLE_HASH, SAMPLE_CID, documentOwner.address)
      expect(await notary.exists(SAMPLE_HASH)).to.equal(true)
    })

    it('returns false before a document has been notarized', async () => {
      expect(await notary.exists(SAMPLE_HASH)).to.equal(false)
    })

    it('returns false for the zero hash', async () => {
      expect(await notary.exists(ethers.ZeroHash)).to.equal(false)
    })
  })

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTION 7 — Owner Document Tracking
  // ═══════════════════════════════════════════════════════════════════════════

  describe('getDocumentsByOwner() / getMyDocuments()', function () {
    it('getDocumentsByOwner() returns all hashes for a given owner', async () => {
      await notary.connect(notarySigner).notarize(SAMPLE_HASH, SAMPLE_CID, documentOwner.address)
      await notary.connect(notarySigner).notarize(HASH_2, SAMPLE_CID, documentOwner.address)

      const docs = await notary.getDocumentsByOwner(documentOwner.address)
      expect(docs.length).to.equal(2)
      expect(docs).to.include(SAMPLE_HASH)
      expect(docs).to.include(HASH_2)
    })

    it('getDocumentsByOwner() returns an empty array for an address with no documents', async () => {
      const docs = await notary.getDocumentsByOwner(stranger.address)
      expect(docs.length).to.equal(0)
    })

    it('getMyDocuments() returns hashes associated with the caller (document owner)', async () => {
      await notary.connect(notarySigner).notarize(SAMPLE_HASH, SAMPLE_CID, documentOwner.address)
      const docs = await notary.connect(documentOwner).getMyDocuments()
      expect(docs.length).to.equal(1)
      expect(docs[0]).to.equal(SAMPLE_HASH)
    })

    it('documents notarized by different notaries are all tracked under the same owner', async () => {
      await notary.connect(owner).addNotary(notarySigner2.address)

      await notary.connect(notarySigner).notarize(SAMPLE_HASH, SAMPLE_CID, documentOwner.address)
      await notary.connect(notarySigner2).notarize(HASH_2, SAMPLE_CID, documentOwner.address)

      const docs = await notary.getDocumentsByOwner(documentOwner.address)
      expect(docs.length).to.equal(2)
    })

    it('documents for different owners do not cross-contaminate', async () => {
      const [, , , , , anotherOwner] = await ethers.getSigners()

      await notary.connect(notarySigner).notarize(SAMPLE_HASH, SAMPLE_CID, documentOwner.address)
      await notary.connect(notarySigner).notarize(HASH_2, SAMPLE_CID, anotherOwner.address)

      const ownerDocs   = await notary.getDocumentsByOwner(documentOwner.address)
      const anotherDocs = await notary.getDocumentsByOwner(anotherOwner.address)

      expect(ownerDocs.length).to.equal(1)
      expect(anotherDocs.length).to.equal(1)
      expect(ownerDocs[0]).to.equal(SAMPLE_HASH)
      expect(anotherDocs[0]).to.equal(HASH_2)
    })
  })
})
