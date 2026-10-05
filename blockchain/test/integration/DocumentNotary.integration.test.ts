/**
 * test/integration/DocumentNotary.integration.test.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Integration test suite for the GoHash DocumentNotary contract.
 *
 * Account roles (mirrors deploy-local.ts signer layout):
 *   admin  — index 0 : Contract owner; manages notary roles
 *   notary — index 1 : Authorized notary wallet
 *   user   — index 2 : Document owner / end-user
 *
 * Scenarios covered:
 *   1. Authorizing a notary                (admin adds notary, events emitted)
 *   2. Successful notarization             (notary notarizes for user)
 *   3. Unauthorized notarization rejection (user/stranger cannot notarize)
 *   4. Duplicate document rejection        (same hash rejected twice)
 *   5. Document retrieval                  (getDocument returns all 5 fields)
 *   6. Document verification               (verify + exists return correct data)
 *
 * Run:
 *   npx hardhat test test/integration/DocumentNotary.integration.test.ts
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { expect } from 'chai'
import { ethers } from 'hardhat'
import { anyValue } from '@nomicfoundation/hardhat-chai-matchers/withArgs'
import { DocumentNotary } from '../../typechain-types'
import { SignerWithAddress } from '@nomicfoundation/hardhat-ethers/signers'

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Produce a deterministic bytes32 hash from a string label. */
function makeHash(label: string): string {
  return ethers.keccak256(ethers.toUtf8Bytes(label))
}

// ─── Fixtures ────────────────────────────────────────────────────────────────

/** Shared IPFS CIDv0 used across tests. */
const SAMPLE_CID = 'QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG'

// ═════════════════════════════════════════════════════════════════════════════
// Integration Test Suite
// ═════════════════════════════════════════════════════════════════════════════

describe('DocumentNotary — Integration Tests', function () {
  // Shared contract and role signers
  let contract: DocumentNotary
  let admin:     SignerWithAddress   // index 0 — contract owner
  let notary:    SignerWithAddress   // index 1 — authorized notary
  let user:      SignerWithAddress   // index 2 — document owner / end-user
  let stranger:  SignerWithAddress   // index 3 — unauthorized actor

  // Deploy a fresh contract before every test to guarantee isolation
  beforeEach(async () => {
    ;[admin, notary, user, stranger] = await ethers.getSigners()

    const Factory = await ethers.getContractFactory('DocumentNotary')
    contract = (await Factory.connect(admin).deploy()) as DocumentNotary
    await contract.waitForDeployment()
  })

  // ───────────────────────────────────────────────────────────────────────────
  // SCENARIO 1 — Authorizing a Notary
  // ───────────────────────────────────────────────────────────────────────────
  describe('Scenario 1 — Authorizing a Notary', function () {
    it('admin (deployer) is set as contractOwner', async () => {
      expect(await contract.contractOwner()).to.equal(admin.address)
    })

    it('admin can authorize a new notary wallet', async () => {
      await contract.connect(admin).addNotary(notary.address)
      expect(await contract.isNotary(notary.address)).to.equal(true)
    })

    it('addNotary() emits NotaryAdded event with correct args', async () => {
      await expect(contract.connect(admin).addNotary(notary.address))
        .to.emit(contract, 'NotaryAdded')
        .withArgs(notary.address, admin.address)
    })

    it('admin can revoke a notary', async () => {
      await contract.connect(admin).addNotary(notary.address)
      await contract.connect(admin).removeNotary(notary.address)
      expect(await contract.isNotary(notary.address)).to.equal(false)
    })

    it('removeNotary() emits NotaryRemoved event with correct args', async () => {
      await contract.connect(admin).addNotary(notary.address)
      await expect(contract.connect(admin).removeNotary(notary.address))
        .to.emit(contract, 'NotaryRemoved')
        .withArgs(notary.address, admin.address)
    })

    it('isNotary() returns false for an address never added', async () => {
      expect(await contract.isNotary(stranger.address)).to.equal(false)
    })

    it('admin can re-authorize a previously revoked notary', async () => {
      await contract.connect(admin).addNotary(notary.address)
      await contract.connect(admin).removeNotary(notary.address)
      await contract.connect(admin).addNotary(notary.address)
      expect(await contract.isNotary(notary.address)).to.equal(true)
    })
  })

  // ───────────────────────────────────────────────────────────────────────────
  // SCENARIO 2 — Successful Notarization
  // ───────────────────────────────────────────────────────────────────────────
  describe('Scenario 2 — Successful Notarization', function () {
    const DOC_HASH = makeHash('contract-document-2026')

    beforeEach(async () => {
      // Pre-authorize notary for all tests in this block
      await contract.connect(admin).addNotary(notary.address)
    })

    it('authorized notary can successfully notarize a document', async () => {
      await expect(
        contract.connect(notary).notarize(DOC_HASH, SAMPLE_CID, user.address)
      ).to.not.be.reverted
    })

    it('DocumentNotarized event is emitted with all correct fields', async () => {
      await expect(
        contract.connect(notary).notarize(DOC_HASH, SAMPLE_CID, user.address)
      )
        .to.emit(contract, 'DocumentNotarized')
        .withArgs(
          DOC_HASH,
          SAMPLE_CID,
          user.address,
          notary.address,
          anyValue // block.timestamp — validated by EVM, not pinned in tests
        )
    })

    it('notary address and document owner address are recorded separately', async () => {
      await contract.connect(notary).notarize(DOC_HASH, SAMPLE_CID, user.address)
      const [, , docOwner, docNotary] = await contract.getDocument(DOC_HASH)
      expect(docOwner).to.equal(user.address)
      expect(docNotary).to.equal(notary.address)
      expect(docOwner).to.not.equal(docNotary)
    })

    it('document is accessible immediately after notarization', async () => {
      await contract.connect(notary).notarize(DOC_HASH, SAMPLE_CID, user.address)
      expect(await contract.exists(DOC_HASH)).to.equal(true)
    })

    it('IPFS CID is stored and retrievable', async () => {
      await contract.connect(notary).notarize(DOC_HASH, SAMPLE_CID, user.address)
      const [, cid] = await contract.getDocument(DOC_HASH)
      expect(cid).to.equal(SAMPLE_CID)
    })

    it('document hash stored in the owner index after notarization', async () => {
      await contract.connect(notary).notarize(DOC_HASH, SAMPLE_CID, user.address)
      const ownerDocs = await contract.getDocumentsByOwner(user.address)
      expect(ownerDocs).to.include(DOC_HASH)
    })
  })

  // ───────────────────────────────────────────────────────────────────────────
  // SCENARIO 3 — Unauthorized Notarization Rejection
  // ───────────────────────────────────────────────────────────────────────────
  describe('Scenario 3 — Unauthorized Notarization Rejection', function () {
    const DOC_HASH = makeHash('unauthorized-attempt-doc')

    it('stranger (never authorized) cannot notarize', async () => {
      await expect(
        contract.connect(stranger).notarize(DOC_HASH, SAMPLE_CID, user.address)
      ).to.be.revertedWithCustomError(contract, 'NotAuthorizedNotary')
    })

    it('user wallet cannot notarize (not in notary role)', async () => {
      await expect(
        contract.connect(user).notarize(DOC_HASH, SAMPLE_CID, user.address)
      ).to.be.revertedWithCustomError(contract, 'NotAuthorizedNotary')
    })

    it('admin cannot notarize without being explicitly added as notary', async () => {
      // Admin manages roles but is NOT automatically a notary
      await expect(
        contract.connect(admin).notarize(DOC_HASH, SAMPLE_CID, user.address)
      ).to.be.revertedWithCustomError(contract, 'NotAuthorizedNotary')
    })

    it('revoked notary cannot notarize after removal', async () => {
      await contract.connect(admin).addNotary(notary.address)
      await contract.connect(admin).removeNotary(notary.address)
      await expect(
        contract.connect(notary).notarize(DOC_HASH, SAMPLE_CID, user.address)
      ).to.be.revertedWithCustomError(contract, 'NotAuthorizedNotary')
    })

    it('non-admin cannot add notary roles', async () => {
      await expect(
        contract.connect(stranger).addNotary(notary.address)
      ).to.be.revertedWithCustomError(contract, 'NotContractOwner')
    })

    it('non-admin cannot remove notary roles', async () => {
      await contract.connect(admin).addNotary(notary.address)
      await expect(
        contract.connect(stranger).removeNotary(notary.address)
      ).to.be.revertedWithCustomError(contract, 'NotContractOwner')
    })
  })

  // ───────────────────────────────────────────────────────────────────────────
  // SCENARIO 4 — Duplicate Document Rejection
  // ───────────────────────────────────────────────────────────────────────────
  describe('Scenario 4 — Duplicate Document Rejection', function () {
    const DOC_HASH = makeHash('unique-contract-doc')

    beforeEach(async () => {
      await contract.connect(admin).addNotary(notary.address)
      // First notarization succeeds
      await contract.connect(notary).notarize(DOC_HASH, SAMPLE_CID, user.address)
    })

    it('rejects second notarization of the same hash with DocumentAlreadyNotarized', async () => {
      await expect(
        contract.connect(notary).notarize(DOC_HASH, SAMPLE_CID, user.address)
      ).to.be.revertedWithCustomError(contract, 'DocumentAlreadyNotarized')
    })

    it('rejects duplicate even when called by a different notary', async () => {
      const notary2 = stranger // re-use stranger slot — authorize them as a second notary
      await contract.connect(admin).addNotary(notary2.address)
      await expect(
        contract.connect(notary2).notarize(DOC_HASH, SAMPLE_CID, user.address)
      ).to.be.revertedWithCustomError(contract, 'DocumentAlreadyNotarized')
    })

    it('different hash can still be notarized after a duplicate attempt', async () => {
      const HASH_2 = makeHash('completely-different-document')
      await expect(
        contract.connect(notary).notarize(HASH_2, SAMPLE_CID, user.address)
      ).to.not.be.reverted
    })

    it('rejects zero hash with InvalidHash', async () => {
      await expect(
        contract.connect(notary).notarize(ethers.ZeroHash, SAMPLE_CID, user.address)
      ).to.be.revertedWithCustomError(contract, 'InvalidHash')
    })

    it('rejects zero owner address with InvalidAddress', async () => {
      const HASH_NEW = makeHash('zero-owner-test')
      await expect(
        contract.connect(notary).notarize(HASH_NEW, SAMPLE_CID, ethers.ZeroAddress)
      ).to.be.revertedWithCustomError(contract, 'InvalidAddress')
    })
  })

  // ───────────────────────────────────────────────────────────────────────────
  // SCENARIO 5 — Document Retrieval
  // ───────────────────────────────────────────────────────────────────────────
  describe('Scenario 5 — Document Retrieval', function () {
    const DOC_HASH  = makeHash('retrieval-test-document')
    const DOC_HASH2 = makeHash('retrieval-test-document-2')

    beforeEach(async () => {
      await contract.connect(admin).addNotary(notary.address)
      await contract.connect(notary).notarize(DOC_HASH, SAMPLE_CID, user.address)
    })

    it('getDocument() returns correct documentHash field', async () => {
      const [hash] = await contract.getDocument(DOC_HASH)
      expect(hash).to.equal(DOC_HASH)
    })

    it('getDocument() returns correct IPFS CID field', async () => {
      const [, cid] = await contract.getDocument(DOC_HASH)
      expect(cid).to.equal(SAMPLE_CID)
    })

    it('getDocument() returns correct owner address', async () => {
      const [, , docOwner] = await contract.getDocument(DOC_HASH)
      expect(docOwner).to.equal(user.address)
    })

    it('getDocument() returns correct notary address', async () => {
      const [, , , docNotary] = await contract.getDocument(DOC_HASH)
      expect(docNotary).to.equal(notary.address)
    })

    it('getDocument() returns a non-zero timestamp', async () => {
      const [, , , , ts] = await contract.getDocument(DOC_HASH)
      expect(ts).to.be.greaterThan(0n)
    })

    it('getDocument() reverts for an unknown hash', async () => {
      const unknown = makeHash('never-notarized')
      await expect(contract.getDocument(unknown)).to.be.revertedWithCustomError(
        contract, 'DocumentNotFound'
      )
    })

    it('getDocumentsByOwner() returns all hashes for an owner', async () => {
      await contract.connect(notary).notarize(DOC_HASH2, SAMPLE_CID, user.address)
      const docs = await contract.getDocumentsByOwner(user.address)
      expect(docs.length).to.equal(2)
      expect(docs).to.include(DOC_HASH)
      expect(docs).to.include(DOC_HASH2)
    })

    it('getDocumentsByOwner() returns empty array for an address with no docs', async () => {
      const docs = await contract.getDocumentsByOwner(stranger.address)
      expect(docs.length).to.equal(0)
    })

    it('getMyDocuments() returns correct hashes for the caller (user)', async () => {
      const docs = await contract.connect(user).getMyDocuments()
      expect(docs.length).to.equal(1)
      expect(docs[0]).to.equal(DOC_HASH)
    })

    it('documents for different owners do not cross-contaminate', async () => {
      await contract.connect(notary).notarize(DOC_HASH2, SAMPLE_CID, stranger.address)
      const userDocs     = await contract.getDocumentsByOwner(user.address)
      const strangerDocs = await contract.getDocumentsByOwner(stranger.address)
      expect(userDocs.length).to.equal(1)
      expect(strangerDocs.length).to.equal(1)
      expect(userDocs[0]).to.equal(DOC_HASH)
      expect(strangerDocs[0]).to.equal(DOC_HASH2)
    })
  })

  // ───────────────────────────────────────────────────────────────────────────
  // SCENARIO 6 — Document Verification
  // ───────────────────────────────────────────────────────────────────────────
  describe('Scenario 6 — Document Verification', function () {
    const DOC_HASH = makeHash('verification-test-document')

    beforeEach(async () => {
      await contract.connect(admin).addNotary(notary.address)
      await contract.connect(notary).notarize(DOC_HASH, SAMPLE_CID, user.address)
    })

    it('exists() returns true for a notarized document', async () => {
      expect(await contract.exists(DOC_HASH)).to.equal(true)
    })

    it('exists() returns false for a document never notarized', async () => {
      expect(await contract.exists(makeHash('not-notarized'))).to.equal(false)
    })

    it('exists() returns false for the zero hash', async () => {
      expect(await contract.exists(ethers.ZeroHash)).to.equal(false)
    })

    it('verify() returns correct owner address', async () => {
      const [docOwner] = await contract.verify(DOC_HASH)
      expect(docOwner).to.equal(user.address)
    })

    it('verify() returns correct notary address', async () => {
      const [, docNotary] = await contract.verify(DOC_HASH)
      expect(docNotary).to.equal(notary.address)
    })

    it('verify() returns a non-zero timestamp', async () => {
      const [, , ts] = await contract.verify(DOC_HASH)
      expect(ts).to.be.greaterThan(0n)
    })

    it('verify() returns correct IPFS CID', async () => {
      const [, , , cid] = await contract.verify(DOC_HASH)
      expect(cid).to.equal(SAMPLE_CID)
    })

    it('verify() reverts with DocumentNotFound for an unknown hash', async () => {
      await expect(
        contract.verify(makeHash('unknown-document'))
      ).to.be.revertedWithCustomError(contract, 'DocumentNotFound')
    })

    it('full end-to-end: admin authorizes notary → notary notarizes → user verifies', async () => {
      // Fresh contract — start from scratch
      const Factory       = await ethers.getContractFactory('DocumentNotary')
      const freshContract = (await Factory.connect(admin).deploy()) as DocumentNotary
      await freshContract.waitForDeployment()

      const E2E_HASH = makeHash('end-to-end-document')
      const E2E_CID  = 'QmE2Etest1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZabc'

      // Step 1: Admin authorizes the notary
      await freshContract.connect(admin).addNotary(notary.address)
      expect(await freshContract.isNotary(notary.address)).to.equal(true)

      // Step 2: Notary notarizes the document on behalf of the user
      await freshContract.connect(notary).notarize(E2E_HASH, E2E_CID, user.address)
      expect(await freshContract.exists(E2E_HASH)).to.equal(true)

      // Step 3: Anyone can verify the document
      const [retOwner, retNotary, retTs, retCid] = await freshContract.verify(E2E_HASH)
      expect(retOwner).to.equal(user.address)
      expect(retNotary).to.equal(notary.address)
      expect(retTs).to.be.greaterThan(0n)
      expect(retCid).to.equal(E2E_CID)
    })
  })
})
