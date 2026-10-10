# GoHash — Blockchain-Based Digital Notary System

A decentralized notary platform where users can hash, timestamp, and certify documents on the blockchain, ensuring tamper-evident, independently verifiable proof-of-existence.

---

## 🧱 Tech Stack

| Layer      | Technology                           |
|------------|--------------------------------------|
| Frontend   | React + TypeScript + Vite            |
| Backend    | Node.js + Express + TypeScript       |
| Database   | MongoDB (via Mongoose)               |
| Blockchain | Hardhat + Solidity (local / testnet) |

---

## 📂 Project Structure

```
GoHash/
├── frontend/          # React TypeScript app (Vite)
├── backend/           # Node.js Express API
├── blockchain/        # Hardhat smart contracts
│   ├── contracts/
│   │   └── DocumentNotary.sol   # Core notarization contract
│   ├── scripts/
│   │   └── deploy.ts            # Deployment script
│   ├── test/
│   │   └── DocumentNotary.test.ts
│   └── hardhat.config.ts
├── .gitignore
└── README.md
```

---

## 📜 Smart Contract — `DocumentNotary.sol`

### Overview

`DocumentNotary` is the core on-chain contract. It stores a cryptographic fingerprint (SHA-256 hash) and an IPFS content identifier for each notarized document. No document content ever touches the blockchain.

### Access Control

The contract uses a two-tier role model:

| Role              | How it's set                          | Capabilities                                      |
|-------------------|---------------------------------------|---------------------------------------------------|
| **Contract Owner** | Set to the deployer at construction  | Add / remove authorized notary addresses          |
| **Notary**         | Added by the contract owner          | Call `notarize()` to register a document on-chain |

> A wallet is **not** automatically a notary after deployment — the owner must explicitly call `addNotary()`.

### Document Record

Each notarized document stores:

| Field          | Type      | Description                                          |
|----------------|-----------|------------------------------------------------------|
| `documentHash` | `bytes32` | SHA-256 hash of the document                         |
| `ipfsCid`      | `string`  | IPFS CID (v0 or v1) pointing to the stored document  |
| `owner`        | `address` | Wallet that owns / submitted the document            |
| `notary`       | `address` | Authorized notary wallet that performed the action   |
| `timestamp`    | `uint256` | Block timestamp at the moment of notarization        |

### Functions

#### Owner Functions

```solidity
// Authorize a new notary wallet
function addNotary(address notary) external

// Revoke an existing notary wallet
function removeNotary(address notary) external

// Check authorization status
function isNotary(address notary) external view returns (bool)
```

#### Notary Functions

```solidity
// Notarize a document (only callable by authorized notaries)
// documentHash — SHA-256 hash as bytes32
// ipfsCid      — IPFS content identifier
// owner        — Address of the document owner
function notarize(bytes32 documentHash, string calldata ipfsCid, address owner) external
```

#### Public View Functions

```solidity
// Retrieve the full document record
function getDocument(bytes32 documentHash)
    external view returns (bytes32, string memory, address, address, uint256)

// Verify a document and return owner, notary, timestamp, and CID
function verify(bytes32 documentHash)
    external view returns (address, address, uint256, string memory)

// Check if a hash has been notarized
function exists(bytes32 documentHash) external view returns (bool)

// Get all document hashes for a given owner address
function getDocumentsByOwner(address owner) external view returns (bytes32[] memory)

// Get all document hashes for the caller
function getMyDocuments() external view returns (bytes32[] memory)
```

### Events

| Event                | Emitted when                              |
|----------------------|-------------------------------------------|
| `DocumentNotarized`  | A document is successfully notarized      |
| `NotaryAdded`        | A new notary address is authorized        |
| `NotaryRemoved`      | A notary address is revoked               |

### Custom Errors

| Error                      | Trigger                                            |
|----------------------------|----------------------------------------------------|
| `NotContractOwner`         | Non-owner calls an owner-only function             |
| `NotAuthorizedNotary`      | Non-notary calls `notarize()`                      |
| `DocumentAlreadyNotarized` | The same hash is submitted a second time           |
| `DocumentNotFound`         | `getDocument()` / `verify()` called on unknown hash|
| `InvalidHash`              | `documentHash` is the zero hash                    |
| `InvalidAddress`           | Zero address passed as `owner` or `notary`         |
| `NotaryAlreadyAuthorized`  | `addNotary()` called for an already-active notary  |
| `NotaryNotFound`           | `removeNotary()` called for a non-notary address   |

---

## 🚀 Getting Started

### Prerequisites
- Node.js >= 18
- npm >= 9
- MongoDB (local or Atlas URI)
- MetaMask browser extension (for frontend wallet)

---

### 1. Blockchain (Hardhat Environment)

#### Compilation & Local Node

Compile the smart contracts and launch a local JSON-RPC Ethereum node:

```bash
# From blockchain/ directory:
cd blockchain
npm install
npm run compile           # Compiles Solidity contracts & generates TypeChain bindings
npm run node              # Starts local Hardhat node on http://127.0.0.1:8545 (Chain ID: 31337)

# OR from project root:
npm run blockchain:compile
npm run blockchain:node
```

#### Pre-Configured Test Accounts

Hardhat generates 20 deterministic accounts (each pre-funded with 10,000 ETH). GoHash assigns specific roles to the first accounts:

| Role | Index | Address | Private Key | Purpose |
|------|-------|---------|-------------|---------|
| **Admin** | `0` | `0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266` | `see `hardhat node` output (account #0)` | Contract deployer & owner (`addNotary` / `removeNotary`) |
| **Notary** | `1` | `0x70997970C51812dc3A010C7d01b50e0d17dc79C8` | `see `hardhat node` output (account #1)` | Authorized notary wallet (`notarize`) |
| **User** | `2` | `0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC` | `see `hardhat node` output (account #2)` | Document owner / client |
| **Stranger** | `3` | `0x90F79bf6EB2c4f870365E785982E1f101E93b906` | `see `hardhat node` output (account #3)` | Unauthorized wallet for access rejection tests |

Inspect all test accounts and balances at any time:
```bash
# In blockchain/:
npm run accounts

# In root:
npm run blockchain:accounts
```

#### Local Deployment

In a separate terminal (while `npm run node` is running):

```bash
# Full local deployment with authorization & on-chain verification smoke test:
cd blockchain
npm run deploy:local:full

# OR standard deployment:
npm run deploy:local
```

The full deployment script (`scripts/deploy-local.ts`) automatically:
1. Deploys `DocumentNotary` using the **Admin** account.
2. Authorizes the **Notary** account on-chain.
3. Performs an end-to-end smoke-test notarization of a sample document with IPFS CID.
4. Verifies the document on-chain and checks that `isNotary` returns `true`.
5. Prints the contract address and environment variables ready to paste into `backend/.env` and `frontend/.env`.

#### Running Tests

```bash
# Run the complete test suite (128 passing tests):
cd blockchain
npm test

# Run only the 6 core integration test scenarios:
npm run test:integration

# Run unit / regression tests:
npm run test:unit
```

Or from the project root:
```bash
npm run blockchain:test
npm run blockchain:test:integration
npm run blockchain:test:unit
```

#### Verified Test Scenarios

The test suite validates:
- **Authorizing a notary:** Admin authorizes notary wallet, `NotaryAdded` event emitted; admin revokes and re-authorizes notary.
- **Successful notarization:** Authorized notary certififes document with SHA-256 hash & IPFS CID; `DocumentNotarized` event emitted with distinct owner and notary addresses.
- **Unauthorized notarization rejection:** Rejects notarization attempts by unauthorized strangers, regular users, and deployer without notary role with `NotAuthorizedNotary`. Rejects role tampering by non-admin with `NotContractOwner`.
- **Duplicate document rejection:** Rejects submitting the same document hash twice with `DocumentAlreadyNotarized`, including attempts across different notaries.
- **Document retrieval:** `getDocument()` returns `documentHash`, `ipfsCid`, `owner`, `notary`, and `timestamp`. `getDocumentsByOwner()` and `getMyDocuments()` correctly filter and isolate user records.
- **Document verification:** `exists()` boolean existence check; `verify()` returns ownership and certification metadata; reverts with `DocumentNotFound` for unknown hashes; full end-to-end verification flow.

---

### 2. Backend (Express API)

```bash
cd backend
npm install
cp .env.example .env      # Fill in your MongoDB URI & contract address
npm run dev               # Starts on http://localhost:5000
```

---

### 3. Frontend (React + Vite)

```bash
cd frontend
npm install
cp .env.example .env      # Fill in the backend API URL
npm run dev               # Starts on http://localhost:5173
```

---

## 🔐 Core Features

- [x] SHA-256 document hash notarized on-chain with timestamp
- [x] IPFS CID stored per document record
- [x] Document owner and notary addresses recorded separately
- [x] Duplicate notarization prevention
- [x] Authorized notary management (add / remove)
- [x] Full document retrieval and verification functions
- [x] Custom Solidity errors and events
- [ ] Upload & SHA-256 hash a document client-side
- [ ] User authentication (JWT)
- [ ] Certificate PDF generation
- [ ] Multi-chain support

---

## 📜 License

MIT
