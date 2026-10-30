# GoHash — Blockchain-Based Digital Notary System

GoHash creates a cryptographic fingerprint (SHA-256) of a digital document and records its notarization proof on a blockchain, enabling tamper-evident, timestamped and independently verifiable document integrity.

---

## What This Is Not

- **A prototype**, not a production service. It runs on a local Hardhat test blockchain; restarting the node erases all on-chain records.
- **No legal validity.** A GoHash notarization certificate is a technical integrity proof, not a legally recognized notarial act. It does not replace Aadhaar-based eSign, DigiLocker, or a registered notary public.
- **Not a replacement for DigiLocker or eSign.** DigiLocker and eSign are government-backed services that provide legal document authentication. GoHash demonstrates the concept of tamper-evident document fingerprinting; it does not confer legal weight.

---

## How It Works

```
USER uploads PDF
      │
      ▼
Backend computes SHA-256 (server-side only; PDF stays on server disk)
      │
      ▼
USER requests notarization → Notarization record created (status: REQUESTED)
      │
      ▼
NOTARY reviews document in browser → clicks "Approve & Notarize"
      │
      ▼
Backend verifies preconditions (notary wallet linked, authorized on-chain, owner wallet linked, hash not already registered)
      │
      ▼
Backend returns { contractAddress, chainId, abi, method:"notarize", args:[hash, "", ownerWallet] }
      │
      ▼
MetaMask opens in NOTARY's browser → NOTARY signs the notarize() transaction (pays gas only; no ETH transferred)
      │
      ▼
Smart contract (DocumentNotary.sol) records hash + owner + notary + block.timestamp on-chain
      │
      ▼
NOTARY sends transactionHash to backend via POST /api/notarization/:id/confirm
      │
      ▼
Backend verifies receipt: tx succeeded + correct contract + DocumentNotarized event + notary wallet matches + correct hash
      │
      ▼
Document status set to NOTARIZED; anyone can verify via POST /api/verify
```

---

## Roles and Wallets

| Role     | GoHash Privilege                                      | Hardhat Test Account     |
|:---------|:------------------------------------------------------|:-------------------------|
| USER     | Upload documents, request notarization, view own docs | Account #2 (`0x3C44...`) |
| NOTARY   | Review pending requests, approve or reject, sign tx   | Account #1 (`0x7099...`) |
| ADMIN    | Manage users/roles, authorize notary wallets on-chain | Account #0 (`0xf39F...`) |

> The ADMIN wallet is the contract deployer (`contractOwner`). Only this wallet can call `addNotary()` / `removeNotary()` on the smart contract.

---

## Architecture

```
┌──────────────────────────────────────────────────────────┐
│  Browser (Untrusted)                                     │
│  ┌────────────────┐   JWT    ┌─────────────────────────┐ │
│  │ React / Vite   │ ◄──────► │ MetaMask (wallet only)  │ │
│  │ :5173          │          │ signs tx / message only  │ │
│  └───────┬────────┘          └─────────────────────────┘ │
└──────────│───────────────────────────────────────────────┘
           │ REST / JSON (JWT bearer)
┌──────────▼───────────────────────────────────────────────┐
│  Backend (Trust Boundary — decides all results)          │
│  Express + TypeScript  :5000                             │
│  - Computes SHA-256 (server-side only)                   │
│  - Read-only JSON-RPC provider (no private key)          │
│  - Verifies on-chain receipts before NOTARIZED           │
│  - Stores PDF on disk: backend/uploads/<id>.pdf          │
└──────┬──────────────────────────┬────────────────────────┘
       │ Mongoose                 │ ethers.js read-only
┌──────▼──────┐          ┌───────▼──────────────────────── ┐
│  MongoDB    │          │  Hardhat Local Node  :8545       │
│  :27017     │          │  DocumentNotary.sol              │
│  gohash     │          │  Chain ID 31337                  │
└─────────────┘          └──────────────────────────────────┘
```

### Where Data Is Stored

| Data                              | Where                                              |
|:----------------------------------|:---------------------------------------------------|
| User accounts, roles, wallets     | MongoDB `gohash.users`                             |
| Document metadata & SHA-256 hash  | MongoDB `gohash.documents`                         |
| Notarization state & receipts     | MongoDB `gohash.notarizations`                     |
| PDF files                         | `backend/uploads/<documentId>.pdf` (not on-chain)  |
| On-chain proof (hash, wallets, ts)| `DocumentNotary.sol` on Hardhat local node         |
| Contract address & ABI            | `blockchain/deployments/localhost.json`            |
| JWT session token                 | Browser `localStorage`                             |
| Pending tx hash (recovery)        | Browser `sessionStorage` (key: `notarization_tx_<id>`) |

---

## Tech Stack

| Layer      | Technology                                    |
|:-----------|:----------------------------------------------|
| Frontend   | React 18 + TypeScript + Vite 5 + Tailwind CSS 3 |
| Backend    | Node.js + Express 4 + TypeScript + Mongoose 8  |
| Database   | MongoDB (Docker container `gohash-mongo`)      |
| Blockchain | Hardhat 2 + Solidity 0.8.24 + ethers.js 6      |
| Auth       | JWT (jsonwebtoken), bcryptjs                   |
| Validation | Zod 4                                          |

---

## Features by Role

### USER
- Register and log in
- Link MetaMask wallet (free signed message, no transaction)
- Upload PDF documents (up to 10 MB); server computes SHA-256
- View document list, metadata, and authenticated PDF preview
- Request notarization for any of your PENDING documents
- View notarization certificate once NOTARIZED
- Verify any document via the public `/verify` page

### NOTARY
- All USER features
- View pending notarization request queue
- Review document metadata and stream PDF inline
- Approve a request (MetaMask signs the `notarize()` transaction)
- Reject a request with a written reason

### ADMIN
- All NOTARY features
- View system-wide stats and notarization activity feed
- Manage all users: view, change role, enable/disable account
- Authorize or revoke notary wallets on-chain via MetaMask (`addNotary` / `removeNotary`)

---

## Prerequisites

- **Node.js ≥ 18** and **npm ≥ 9**
- **Docker Desktop** (running) — for MongoDB
- **Google Chrome** with the **MetaMask** extension installed
- **Git**

---

## Setup from a Fresh Clone

Run every command block in **PowerShell**.

### Step 1 — Clone and install

```powershell
git clone <your-repo-url> GoHash
cd GoHash

# Install each workspace
cd backend;    npm install; cd ..
cd frontend;   npm install; cd ..
cd blockchain; npm install; cd ..
```

### Step 2 — Configure environment files

```powershell
# Backend
cd backend
Copy-Item .env.example .env
```

Open `backend\.env` and set:

| Variable | What to set |
|:---------|:------------|
| `JWT_SECRET` | Any random string of **32 or more** characters (e.g. from a password manager). Never commit this value. |
| `SEED_ADMIN_PASSWORD` | At least 8 characters. Used only by `npm run seed`. |
| `SEED_NOTARY_PASSWORD` | At least 8 characters. Used only by `npm run seed`. |

All other values in `.env.example` are correct for local development.

```powershell
# Frontend
cd ..\frontend
Copy-Item .env.example .env
```

The frontend `.env.example` values are correct as-is for local development.
The contract address is loaded from the backend deployment artifact; do not add a
hardcoded contract address to the frontend environment.

### Step 3 — Start MongoDB

```powershell
# From the project root (docker-compose.yml defines the named volume mongo-data)
docker compose up -d
```

> **Persistence:** The compose file defines the named Docker volume `mongo-data` mapped to `/data/db`, so data survives container restarts. If you remove the container *and* the volume (`docker compose down -v`), all MongoDB data is lost.

Verify it is running:

```powershell
docker ps --filter name=gohash-mongo
```

### Step 4 — Seed admin and notary accounts

```powershell
cd backend
npm run seed
```

This creates (or updates) two accounts in the `gohash` database:
- `admin@gohash.io` with role `ADMIN`
- `notary@gohash.io` with role `NOTARY`

Passwords are taken from `backend/.env` (`SEED_ADMIN_PASSWORD`, `SEED_NOTARY_PASSWORD`).

---

## Running the Application

You need **four terminals** running simultaneously.

| Terminal | Directory    | Command                                                                       | Result |
|:---------|:-------------|:------------------------------------------------------------------------------|:-------|
| 1        | `blockchain` | `npx hardhat node`                                                            | JSON-RPC node at `http://127.0.0.1:8545` |
| 2        | `blockchain` | `npx hardhat run scripts/deploy-local.ts --network localhost`                 | Deploys contract; writes `blockchain/deployments/localhost.json` |
| 3        | `backend`    | `npm run dev`                                                                 | API at `http://localhost:5000` |
| 4        | `frontend`   | `npm run dev`                                                                 | UI at `http://localhost:5173` |

> **After every Hardhat node restart:** re-run the deploy script (terminal 2) and restart the backend (terminal 3) so it reloads `localhost.json`. Also clear MetaMask activity data for the Hardhat Local network.

### Health Checks

```powershell
# Backend API health
Invoke-RestMethod http://localhost:5000/api/health

# Confirm Hardhat node chain ID (should return {"id":1,"jsonrpc":"2.0","result":"0x7a69"})
Invoke-RestMethod -Method Post -Uri http://127.0.0.1:8545 `
  -ContentType application/json `
  -Body '{"jsonrpc":"2.0","method":"eth_chainId","params":[],"id":1}'

# Confirm deployment file exists
Get-Content blockchain\deployments\localhost.json | ConvertFrom-Json | Select-Object address,chainId
```

---

## MetaMask Setup

1. Open MetaMask → **Add a custom network**:
   - **Network name:** `Hardhat Local`
   - **RPC URL:** `http://127.0.0.1:8545`
   - **Chain ID:** `31337`
   - **Currency symbol:** `ETH`
   - (The "could not fetch chain ID" or "suggested symbol" warning is normal for a local test chain.)

2. Import test accounts using the private keys printed by `npx hardhat node`.

   **NEVER write a private key into any file.** Copy it directly from the terminal and paste only into MetaMask.

   | Account | Address | Role in GoHash |
   |:--------|:--------|:---------------|
   | #0 | `0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266` | Admin (contract deployer) |
   | #1 | `0x70997970C51812dc3A010C7d01b50e0d17dc79C8` | Notary |
   | #2 | `0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC` | User (document owner) |

3. In MetaMask: click the account icon → **Import account** → paste the private key for each account.

---

## Demo Script (13 Steps)

### Preparation
1. All four terminals running; MetaMask accounts #0, #1, #2 imported.

### User workflow
2. Open `http://localhost:5173/register` and register as **Alice** (any email/password).
3. In MetaMask, switch to **Account #2** (User).
4. In GoHash, go to `/profile` → click **Link MetaMask Wallet** → sign the message (free, no gas).
5. Go to `/upload` → drag a PDF file → click **Upload**. Copy the SHA-256 hash shown.
6. Go to `/documents/:id` (the document just uploaded) → click **Request Notarization** → confirm.
   Document status changes to **REQUESTED**.

### Notary workflow
7. Log out. Log in as `notary@gohash.io` (password from `backend/.env`).
8. In MetaMask, switch to **Account #1** (Notary).
9. Go to `/profile` → link **Account #1** as the wallet.
10. Go to `/notary/dashboard` → find Alice's request → click **Review**.
11. Click **Open PDF** to inspect the document, then click **Approve & Notarize**.
    Watch the five-step state machine: *Preparing → MetaMask popup → Pending on-chain → Verifying → Confirmed*.

### Verification and tamper demo
12. Log back in as Alice → open `/documents/:id` → notice status is **NOTARIZED**.
    Click **View Certificate** to see the printable notarization certificate.
13. Go to `/verify` (no login required). Upload the **original** PDF → result is **VERIFIED**.
    Now run the tamper demo:

```powershell
# Get hash of original file
Get-FileHash .\original.pdf -Algorithm SHA256

# Create a tampered copy (one extra space appended)
$content = [System.IO.File]::ReadAllBytes(".\original.pdf")
$tampered = $content + [byte]0x20
[System.IO.File]::WriteAllBytes(".\tampered.pdf", $tampered)

# Get hash of tampered copy — it will be different
Get-FileHash .\tampered.pdf -Algorithm SHA256
```

Upload `tampered.pdf` to `/verify` → result is **TAMPERED / NOT VERIFIED** (hash does not match any on-chain record).

---

## Tests

| Command | Run from | Needs | Covers |
|:--------|:---------|:------|:-------|
| `npx hardhat test` | `blockchain/` | Nothing (self-contained) | 128 Mocha/Chai assertions: contract deployment, notarize, reject, duplicates, access control, events, view functions |
| `npm run test:smoke` | `backend/` | Docker MongoDB | ~27 assertions: auth, upload, document CRUD, notarization request, ownership isolation |
| `npm run test:chain` | `backend/` | Docker MongoDB + Hardhat node running + contract deployed | 31 assertions: full approve→sign→confirm flow, receipt verification edge cases, admin routes, verify endpoint |
| `npm run test:rbac` | `backend/` | Docker MongoDB + Hardhat node running + contract deployed | 26-endpoint RBAC matrix, ownership isolation (5 routes), sensitive-field leak check |
| `npm run test:all` | `backend/` | Docker MongoDB + Hardhat node + contract deployed | Runs smoke, chain, rbac in sequence |

> `test:chain` and `test:rbac` require the Hardhat node to be running and the contract deployed. If the node is not running, those tests exit immediately with a connectivity error.

---

## Troubleshooting

| Symptom | Cause | Fix |
|:--------|:------|:----|
| `Missing script: "dev"` | Running command in the wrong directory | `cd backend` (or `cd frontend`) first |
| `MongoDB not reachable` | Docker container not running | `docker start gohash-mongo` |
| `ECONNREFUSED 127.0.0.1:8545` | Hardhat node not started | `cd blockchain; npx hardhat node` |
| `CONTRACT_NOT_DEPLOYED` | Deployment file missing or backend started before deploy | `cd blockchain; npx hardhat run scripts/deploy-local.ts --network localhost`, then restart backend |
| MetaMask "nonce too high" error | Hardhat node was restarted, MetaMask cached old nonce | MetaMask → Settings → Advanced → **Clear activity and nonce data** for Hardhat Local |
| MetaMask shows "Wrong network" | MetaMask is on a different network | Switch to **Hardhat Local** (Chain ID 31337) |
| `/verify` shows NOT_VERIFIED for a document that was notarized | The Hardhat node was restarted (on-chain data erased) | Redeploy the contract and re-run the notarization flow |
| `address already in use :::5000` | Another backend process is running | `npx kill-port 5000` or close the other terminal |

---

## Security Notes

- The backend **never holds a private key or mnemonic**. All signing is done in the user's MetaMask.
- SHA-256 is computed server-side only; the browser never hashes files.
- Wallet linking uses a one-time challenge message (free; no transaction; no private key transmitted).
- The backend verifies the on-chain receipt independently before marking a document NOTARIZED: it checks transaction success, correct contract address, correct document hash in the `DocumentNotarized` event, and that the transaction sender matches the notary's registered wallet.
- PDFs are stored unencrypted on disk at `backend/uploads/`. Access is controlled by the JWT bearer token; the files are gitignored.
- The JWT is stored in browser `localStorage`. This is standard for SPAs but means it is accessible to JavaScript. In a production system, consider HttpOnly cookies.
- Rate limiting is applied to `POST /api/auth/login` (configurable via `AUTH_RATE_LIMIT_MAX`) and `POST /api/verify` (`VERIFY_RATE_LIMIT_PER_MIN`).

---

## Limitations and Future Scope

| Limitation | Detail |
|:-----------|:-------|
| Local chain only | One Hardhat node; no persistence across node restarts; no public blockchain |
| Unencrypted PDFs | Files stored in plain text on the backend server |
| Notary identity | Linked only to a wallet address; no verification against Aadhaar or DSC |
| JWT in localStorage | Accessible to JavaScript (XSS risk in production) |
| No IPFS | The contract has an `ipfsCid` field; it is always sent as `""` |
| No legal validity | Technical prototype only |

**Future scope:**
- IPFS integration with file encryption for decentralized, private document storage
- Deployment to a public testnet (Sepolia) or a permissioned chain
- DSC (Digital Signature Certificate) or Aadhaar eSign integration for legally recognized notary identity
- Per-document audit logs stored as on-chain events (append-only, publicly verifiable)
- HttpOnly cookie sessions instead of localStorage JWTs
- Multi-notary and multi-organization support

---

## Project Structure

```
GoHash/
├── backend/
│   ├── scripts/
│   │   ├── seed.ts              # Seed admin & notary accounts
│   │   ├── smoke-test.ts        # API integration tests (~27 assertions)
│   │   ├── chain-test.ts        # Full blockchain flow tests (31 assertions)
│   │   └── rbac-test.ts         # RBAC matrix + security audit (26 endpoints)
│   ├── src/
│   │   ├── config/              # env.ts, db.ts, blockchain.ts
│   │   ├── controllers/         # auth, document, notarization, blockchain, verify, admin
│   │   ├── middleware/          # auth, role, validate, error handler
│   │   ├── models/              # User, Document, Notarization (Mongoose schemas)
│   │   ├── routes/              # Express routers
│   │   ├── services/            # auth, hash, blockchain, notarization
│   │   └── validations/         # Zod schemas per route group
│   └── uploads/                 # PDF files (gitignored)
│
├── blockchain/
│   ├── contracts/
│   │   └── DocumentNotary.sol   # Core notarization smart contract (Solidity 0.8.24)
│   ├── deployments/
│   │   └── localhost.json       # Contract address + ABI (written by deploy script)
│   ├── scripts/
│   │   ├── deploy-local.ts      # Full local deploy: deploy + addNotary + smoke test
│   │   └── deploy.ts            # Minimal deploy (no smoke test)
│   └── test/                    # Hardhat/Mocha test files (128 passing)
│
├── frontend/
│   └── src/
│       ├── components/          # UI kit: Button, Card, StatCard, StatusBadge, etc.
│       ├── context/             # WalletContext (ethers.js BrowserProvider)
│       ├── lib/                 # api.ts (fetch wrapper with JWT + progress)
│       ├── pages/
│       │   ├── admin/           # AdminDashboardPage, AdminNotariesPage
│       │   ├── documents/       # NotarizationCertificatePage
│       │   ├── notary/          # NotaryDashboardPage, NotaryRequestDetailPage
│       │   ├── public/          # LandingPage, LoginPage, RegisterPage, VerifyPage
│       │   └── user/            # DashboardPage, DocumentDetailPage, DocumentsPage, ProfilePage, UploadPage
│       ├── routes/              # Route definitions with ProtectedRoute + RoleRoute guards
│       └── types/               # Shared TypeScript interfaces
│
├── docs/
│   ├── API_CONTRACT.md          # Full REST API specification
│   ├── CONTRACT_INTERFACE.md    # DocumentNotary.sol ABI reference
│   ├── PROGRESS.md              # Sprint log and locked decisions
│   ├── architecture.md          # System design and trust boundaries
│   ├── project-flow.md          # User journeys and state machines
│   ├── VIVA.md                  # Viva Q&A
│   └── REQUIREMENTS_COVERAGE.md # Requirements traceability table
│
├── docker-compose.yml           # MongoDB service (container: gohash-mongo, volume: mongo-data)
└── README.md
```

---

## Credits

Built as a final-year engineering project demonstrating blockchain-based document integrity verification.

**Technology credits:** Hardhat (Nomic Foundation), ethers.js, React, Vite, Express, MongoDB, MetaMask.
