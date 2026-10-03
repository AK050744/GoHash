# GoHash — Test Suite

This directory contains the Hardhat / Mocha test suite for the `DocumentNotary` smart contract, organized by development day.

---

## 📁 Directory Layout

```
test/
├── day01/
│   └── DocumentNotary.day01.test.ts   # Baseline proof-of-existence tests
├── day02/
│   └── DocumentNotary.day02.test.ts   # Access control, IPFS CID, full retrieval
└── DocumentNotary.test.ts             # Aggregated regression suite (all days)
```

---

## 🗓️ Per-Day Coverage

### Day 01 — Baseline Proof-of-Existence
**File:** [`day01/DocumentNotary.day01.test.ts`](./day01/DocumentNotary.day01.test.ts)

Tests the original open notarization contract:
- `notarize()` — any wallet could notarize (simulated via notary role)
- `verify()` — retrieves owner, timestamp
- `exists()` — boolean existence check
- `getMyDocuments()` / `getDocumentsByOwner()` — owner tracking
- Duplicate prevention and zero-hash guard

### Day 02 — Access Control, IPFS CID & Full Retrieval
**File:** [`day02/DocumentNotary.day02.test.ts`](./day02/DocumentNotary.day02.test.ts)

Tests all features added on Day 02:
- `contractOwner` — deployer is set as the contract owner
- `addNotary()` / `removeNotary()` — owner-only role management
- `isNotary()` — authorization status check
- `NotaryAdded` / `NotaryRemoved` events
- `notarize()` upgrade — requires `onlyNotary`, stores IPFS CID & separate owner address
- `DocumentNotarized` event — now includes `ipfsCid` and `notary` address
- `getDocument()` — returns all 5 fields of the document record
- `verify()` — returns owner, notary, timestamp, CID
- Owner/notary address isolation and cross-owner document isolation

---

## ▶️ Running Tests

```bash
# Run the full suite (all days)
npx hardhat test

# Run only Day 01 tests
npx hardhat test test/day01/DocumentNotary.day01.test.ts

# Run only Day 02 tests
npx hardhat test test/day02/DocumentNotary.day02.test.ts

# Run the aggregated regression suite
npx hardhat test test/DocumentNotary.test.ts
```

---

## 📊 Expected Results

| Suite                     | Tests | Status          |
|---------------------------|-------|-----------------|
| Day 01 — Baseline         | 11    | ✅ All passing  |
| Day 02 — New Features     | 59    | ✅ All passing  |
| Aggregated (all days)     | 22    | ✅ All passing  |
| **Total (full run)**      | **81**| ✅ All passing  |
