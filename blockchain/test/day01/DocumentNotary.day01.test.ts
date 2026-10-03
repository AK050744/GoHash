/**
 * Day 01 — DocumentNotary: Baseline Tests
 * ─────────────────────────────────────────────────────────────────────────────
 * Scope: Basic proof-of-existence notarization.
 *
 * What was built on Day 01:
 *  • NotarizedDocument struct  (hash, owner, timestamp, description)
 *  • notarize(bytes32, string) — open to any caller
 *  • verify(bytes32)           — returns owner, timestamp, description
 *  • exists(bytes32)           — boolean existence check
 *  • getMyDocuments()          — returns hashes notarized by caller
 *  • getDocumentsByOwner()     — returns hashes for any address
 *  • Custom errors: InvalidHash, DocumentAlreadyNotarized, DocumentNotFound
 *  • Event: DocumentNotarized(hash, owner, timestamp, description)
 *
 * NOTE: Day 01 contract had NO access control — any wallet could notarize.
 *       These tests are preserved for historical reference and regression.
 *       They run against the CURRENT contract using the notary role to
 *       replicate Day 01 open-access behaviour.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { expect } from 'chai'
import { ethers } from 'hardhat'
import { anyValue } from '@nomicfoundation/hardhat-chai-matchers/withArgs'
import { DocumentNotary } from '../../typechain-types'
import { SignerWithAddress } from '@nomicfoundation/hardhat-ethers/signers'

describe('[Day 01] DocumentNotary — Baseline Proof-of-Existence', function () {
  let notary: DocumentNotary
  let owner: SignerWithAddress
  let caller: SignerWithAddress   // simulates "any wallet" from Day 01

  // Simulated SHA-256 hash (keccak256 used here for convenience in tests)
  const SAMPLE_HASH = ethers.keccak256(ethers.toUtf8Bytes('sample-document-content'))
  const DESCRIPTION = 'Test Document'

  beforeEach(async () => {
    ;[owner, caller] = await ethers.getSigners()

    const Factory = await ethers.getContractFactory('DocumentNotary')
    notary = (await Factory.connect(owner).deploy()) as DocumentNotary
    await notary.waitForDeployment()

    // Day 01 had no notary roles — simulate open access by making caller a notary
    // (In Day 01 the contract owner was not needed; everyone could notarize directly)
    await notary.connect(owner).addNotary(caller.address)
  })

  // ─── Core Notarization ────────────────────────────────────────────────────

  it('should notarize a document and emit DocumentNotarized event', async () => {
    await expect(
      notary.connect(caller).notarize(SAMPLE_HASH, '' /* no CID in Day 01 */, caller.address)
    )
      .to.emit(notary, 'DocumentNotarized')
      .withArgs(SAMPLE_HASH, anyValue, caller.address, caller.address, anyValue)
  })

  it('should report a notarized document as existing', async () => {
    await notary.connect(caller).notarize(SAMPLE_HASH, '', caller.address)
    expect(await notary.exists(SAMPLE_HASH)).to.equal(true)
  })

  it('should return false for a hash that has not been notarized', async () => {
    const unknownHash = ethers.keccak256(ethers.toUtf8Bytes('unknown'))
    expect(await notary.exists(unknownHash)).to.equal(false)
  })

  // ─── verify() ─────────────────────────────────────────────────────────────

  it('verify() should return correct owner address after notarization', async () => {
    await notary.connect(caller).notarize(SAMPLE_HASH, '', caller.address)
    const [docOwner] = await notary.verify(SAMPLE_HASH)
    expect(docOwner).to.equal(caller.address)
  })

  it('verify() should return a non-zero timestamp', async () => {
    await notary.connect(caller).notarize(SAMPLE_HASH, '', caller.address)
    const [, , timestamp] = await notary.verify(SAMPLE_HASH)
    expect(timestamp).to.be.greaterThan(0n)
  })

  it('verify() should revert for a non-existent document hash', async () => {
    const fakeHash = ethers.keccak256(ethers.toUtf8Bytes('nonexistent'))
    await expect(notary.verify(fakeHash)).to.be.revertedWithCustomError(
      notary,
      'DocumentNotFound'
    )
  })

  // ─── Duplicate Prevention ─────────────────────────────────────────────────

  it('should revert when the same hash is notarized twice', async () => {
    await notary.connect(caller).notarize(SAMPLE_HASH, '', caller.address)
    await expect(
      notary.connect(caller).notarize(SAMPLE_HASH, '', caller.address)
    ).to.be.revertedWithCustomError(notary, 'DocumentAlreadyNotarized')
  })

  // ─── Input Validation ─────────────────────────────────────────────────────

  it('should revert on a zero document hash', async () => {
    await expect(
      notary.connect(caller).notarize(ethers.ZeroHash, '', caller.address)
    ).to.be.revertedWithCustomError(notary, 'InvalidHash')
  })

  // ─── Owner Document Tracking ──────────────────────────────────────────────

  it('getMyDocuments() should return all hashes for the caller', async () => {
    const hash2 = ethers.keccak256(ethers.toUtf8Bytes('second-doc'))
    await notary.connect(caller).notarize(SAMPLE_HASH, '', caller.address)
    await notary.connect(caller).notarize(hash2, '', caller.address)

    const docs = await notary.connect(caller).getMyDocuments()
    expect(docs.length).to.equal(2)
    expect(docs).to.include(SAMPLE_HASH)
    expect(docs).to.include(hash2)
  })

  it('getDocumentsByOwner() should return hashes for a queried address', async () => {
    const hash2 = ethers.keccak256(ethers.toUtf8Bytes('second-doc'))
    await notary.connect(caller).notarize(SAMPLE_HASH, '', caller.address)
    await notary.connect(caller).notarize(hash2, '', caller.address)

    const docs = await notary.getDocumentsByOwner(caller.address)
    expect(docs.length).to.equal(2)
    expect(docs).to.include(SAMPLE_HASH)
    expect(docs).to.include(hash2)
  })

  it('getDocumentsByOwner() should return an empty array for an address with no documents', async () => {
    const [, , stranger] = await ethers.getSigners()
    const docs = await notary.getDocumentsByOwner(stranger.address)
    expect(docs.length).to.equal(0)
  })
})
