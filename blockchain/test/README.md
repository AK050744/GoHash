# GoHash — Test Suite

This directory contains the Hardhat / Mocha test suite for the `DocumentNotary` smart contract, organized by unit/day milestones and comprehensive integration scenarios.

---

## 📁 Directory Layout

```
test/
├── helpers/
│   └── accounts.ts                    # Deterministic Hardhat test accounts (admin, notary, user, stranger)
├── day01/
│   └── DocumentNotary.day01.test.ts   # Baseline proof-of-existence tests
├── day02/
│   └── DocumentNotary.day02.test.ts   # Access control, IPFS CID, full retrieval
├── integration/
│   └── DocumentNotary.integration.test.ts # End-to-end integration scenarios (6 core flows)
└── DocumentNotary.test.ts             # Aggregated regression suite
```

---

## 🔑 Test Accounts Configuration

Configured in [`helpers/accounts.ts`](./helpers/accounts.ts) using the standard Hardhat mnemonic (`"test test test test test test test test test test test junk"`):

| Role | Signer Index | Address | Private Key | Description |
|------|--------------|---------|-------------|-------------|
| **Admin** | `0` | `0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266` | `see `hardhat node` output (account #0)` | Contract deployer / owner; manages notary authorizations |
| **Notary** | `1` | `0x70997970C51812dc3A010C7d01b50e0d17dc79C8` | `see `hardhat node` output (account #1)` | Authorized notary; executes `notarize()` |
| **User** | `2` | `0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC` | `see `hardhat node` output (account #2)` | Document owner / client; requests notarization |
| **Stranger** | `3` | `0x90F79bf6EB2c4f870365E785982E1f101E93b906` | `see `hardhat node` output (account #3)` | Unauthorized wallet; used for access control rejection tests |

---

## 🧪 Integration Test Coverage

**File:** [`integration/DocumentNotary.integration.test.ts`](./integration/DocumentNotary.integration.test.ts)

Comprehensive end-to-end testing of the contract lifecycle:

1. **Test Accounts Setup**: Verifies admin, notary, and user addresses and positive funding balances.
2. **Scenario 1 — Authorizing a Notary**:
   - Owner authorization (`addNotary`), `NotaryAdded` event emission.
   - Owner revocation (`removeNotary`), `NotaryRemoved` event emission.
   - Re-authorization of previously revoked notaries.
3. **Scenario 2 — Successful Notarization**:
   - Authorized notary notarization with SHA-256 hash, IPFS CID, and document owner address.
   - `DocumentNotarized` event emission.
   - Independent storage of notary and owner addresses.
4. **Scenario 3 — Unauthorized Notarization Rejection**:
   - Stranger rejection (`NotAuthorizedNotary`).
   - Regular user rejection (`NotAuthorizedNotary`).
   - Admin rejection without notary role (`NotAuthorizedNotary`).
   - Revoked notary rejection (`NotAuthorizedNotary`).
   - Non-owner role management attempts rejected (`NotContractOwner`).
5. **Scenario 4 — Duplicate Document Rejection**:
   - Duplicate hash rejection with custom error `DocumentAlreadyNotarized`.
   - Cross-notary duplicate rejection.
   - Zero hash (`InvalidHash`) and zero address (`InvalidAddress`) guards.
6. **Scenario 5 — Document Retrieval**:
   - `getDocument(hash)` returns all 5 fields (`documentHash`, `ipfsCid`, `owner`, `notary`, `timestamp`).
   - `getDocumentsByOwner(address)` and `getMyDocuments()`.
   - Reversion with `DocumentNotFound` for unknown hashes.
   - Strict isolation between documents owned by different addresses.
7. **Scenario 6 — Document Verification**:
   - `exists(hash)` boolean check.
   - `verify(hash)` returning owner, notary, timestamp, and IPFS CID.
   - Reversion with `DocumentNotFound` for unknown hashes.
   - Full round-trip flow: Admin authorizes notary → notary certifies document → user verifies certification.

---

## ▶️ Running Tests

From the `blockchain/` directory:

```bash
# Run the complete test suite (all 128 tests)
npm test

# Run only integration tests (47 tests)
npm run test:integration

# Run unit / regression tests
npm run test:unit

# Run day-specific tests
npx hardhat test test/day01/DocumentNotary.day01.test.ts
npx hardhat test test/day02/DocumentNotary.day02.test.ts
```

From the repository root:

```bash
# Run complete blockchain test suite
npm run blockchain:test

# Run blockchain integration test suite
npm run blockchain:test:integration

# Run unit tests
npm run blockchain:test:unit
```

---

## 📊 Expected Results

| Suite | File | Tests | Status |
|---|---|---|---|
| **Day 01** — Baseline Proof-of-Existence | `test/day01/DocumentNotary.day01.test.ts` | 11 | ✅ All passing |
| **Day 02** — Access Control, IPFS & Retrieval | `test/day02/DocumentNotary.day02.test.ts` | 59 | ✅ All passing |
| **Aggregated** — Regression Suite | `test/DocumentNotary.test.ts` | 22 | ✅ All passing |
| **Integration** — End-to-End Scenarios & Accounts | `test/integration/DocumentNotary.integration.test.ts` | 47 | ✅ All passing |
| **Total (Full Test Run)** | | **128** | ✅ **100% Passing** |
