# GoHash — Blockchain-Based Digital Notary System

A decentralized notary platform where users can hash, timestamp, and certify documents on the blockchain, ensuring tamper-proof proof-of-existence.

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

### 1. Blockchain (Hardhat)

```bash
cd blockchain
npm install
npx hardhat compile
npx hardhat node          # Start local blockchain on port 8545
```

Deploy contracts (in a second terminal):
```bash
npx hardhat run scripts/deploy.ts --network localhost
```

The deploy script will:
1. Deploy `DocumentNotary`
2. Automatically authorize Hardhat's second test account as the initial notary
3. Print the contract address and the `.env` variables to set

Run the test suite:
```bash
npx hardhat test
```

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
