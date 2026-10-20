# GoHash Project Progress

## Status Table

| Milestone | Scope | Status | Notes |
| :--- | :--- | :---: | :--- |
| **Blockchain Days 1–3** | `blockchain/` (Smart contract foundation & tests) | **Complete** | `DocumentNotary.sol` implemented; unit & integration tests passing |
| **Sprint 1A & 1B** | `backend/` (Express foundation & JWT auth / RBAC) | **Complete** | Mongoose models, Zod validation, JWT auth, role middleware |
| **Sprint 2A & 2B** | `frontend/` (Layout shell & Auth UI integration) | **Complete** | Dark theme UI kit, route guards, `/login`, `/register`, `/403` |
| **Sprint 3A** | `backend/` (Document upload, hashing & request) | **Complete** | 27/27 smoke assertions passing with Docker Mongo running |
| **Sprint 3A-TESTFIX** | `backend/` (Test isolation & standalone runner) | **Complete** | Ephemeral port isolation, test DB isolation, fail-fast Mongo check |
| **Sprint 3A-DBFIX** | `backend/` (Dev server fail-fast DB & test route purge) | **Complete** | Removed in-memory fallback (exits code 1 if down), purged test-admin route |
| **Sprint 3B** | `frontend/` (Document upload & management pages) | **Complete** | Upload page, document table, document detail with PDF streaming, and 3 dashboard stat cards |
| **Sprint 4A** | `backend/` (Blockchain services & read-only provider) | **Complete** | Contract deployment, read-only JSON-RPC provider, nonce signing & receipt auditing |
| **Sprint 4B** | `frontend/` (MetaMask integration & notary approval) | **Complete** | WalletContext, navbar wallet button, gas-free linking, notary queue & 5-step approval machine |
| **Sprint 5A & 5B** | Full-stack (Verification API, admin management, certificate) | **Complete** | Public /api/verify, admin dashboard & notaries, on-chain addNotary/removeNotary, certificate export |
| **Sprint 5C** | Full-stack (Metadata visibility controls) | **Next** | Public verification metadata visibility controls |
| **Task F1** | `frontend/` (Notary/Admin access & on-chain authorize modal) | **Complete** | RoleRoute/403 fixes, wallet link flow on Requests & Review, Admin Notaries modal preconditions & stepper timing |
| **Task F2** | Full-stack & Docs (Unique Notarization Key) | **Complete** | Unique notarization key derived from on-chain data (keccak256), public `/api/verify/key/:key` endpoint, CopyButton, certificate & verify tab |
| **Task F3A** | `backend/` & Docs (Notarization fee in test ETH) | **Complete** | Test ETH fee verified on-chain by read-only provider; GET /api/config/fees; POST /api/notarization/:id/payment; approve 402; reject refundDue; stats |
| **Sprint 6A** | Backend (RBAC audit, security hardening, Zod validation) | **Complete** | RBAC matrix test (26 endpoints), Helmet, CORS pinned, rate limiting, JWT HS256 pinned, Zod schemas, typecheck 0 errors |
| **Sprint 6B** | Docs (README, architecture, project-flow, VIVA, REQUIREMENTS_COVERAGE) | **Complete** | README.md rewritten; docs/architecture.md, docs/project-flow.md, docs/VIVA.md, docs/REQUIREMENTS_COVERAGE.md created |

---

## Locked Decisions

- **(a) Backend Key Security**: The backend never holds any private key (deployer or notary). The NOTARY signs the notarize transaction in MetaMask in the browser. The backend utilizes a READ-ONLY JSON-RPC provider. After the browser sends the transaction hash to the backend, the backend verifies the receipt on-chain (transaction success, correct contract address, matching document hash, and verifying that the on-chain signer matches the notary's registered wallet) before marking the document status as `NOTARIZED`.
- **(b) Server-Side Hashing Only**: SHA-256 is computed on the server only. The frontend never uses the Web Crypto API or hashes files client-side; it displays the hash returned by the API.
- **(c) Off-Chain Document Storage**: The PDF is never stored on-chain. Only the cryptographic SHA-256 hash, timestamp, and verification metadata are committed to the blockchain.
- **(d) Database Environment**: Local MongoDB runs in Docker (container name `gohash-mongo`, host port `27017`). The backend requires a real MongoDB instance and immediately terminates with exit code 1 if MongoDB is unreachable; all in-memory database fallbacks have been removed.
- **(e) Project Terminology & Framing**: The system is framed as providing **tamper-evident** and **independently verifiable** proof-of-existence. The system is never described as "100% immutable" or as something that "replaces legal notaries".
- **(f) Shared Contract Architecture**: One shared DocumentNotary contract; no per-user contracts and no NFTs/tokens.
- **(g) Off-Chain Privacy & Metadata Visibility**: The document file is never public and never on-chain; "visibility" (Sprint 5C) only controls which off-chain metadata a public verification result shows.

### Wording & Terminology Standards (UI, Code Comments, API Messages & Docs)

- **UI & Display Wording**:
  - Always use: `"Recorded on-chain at <time>"`, `"tamper-evident"`, and `"independently verifiable"`.
  - An on-chain timestamp means **"the hash was recorded no later than this time"**, not authorship or creation time.
- **Hashing vs. Encryption**:
  - Hashing is a one-way cryptographic digest; **hashing is not encryption**.
  - Never describe document hashing as encryption, and never write `"encrypted hash"`.
- **Prohibited Terminology & Claims**:
  - Never write `"immutable"`, `"unhackable"`, `"cannot be altered"`, `"court-admissible"` / `"admissible"`, or `"impossible collision"`.
  - Never make any **legal-validity claim** (e.g. "replaces legal notaries", "legally binding attestation").
- **Mandatory Acceptance Searches (`frontend/src`)**:
  - The codebase must be audited against these patterns, and every hit reported (target: **0 hits**):
    1. `"immutable"`
    2. `"unhackable"`
    3. `"admissible"`
    4. `"encrypt"`

---

## Docker Setup

### Overview
Local database services run through Docker container `gohash-mongo` using the official `mongo:latest` image.

- **Start Command**: `docker start gohash-mongo` (or `docker compose up -d`)
- **Stop Command**: `docker stop gohash-mongo` (or `docker compose down`)
- **Database Connection URI**: `mongodb://localhost:27017/gohash` (exact value from `backend/.env.example`)
- **Persistence**: Data persists in the named Docker volume `mongo-data` (destination `/data/db`).

### Troubleshooting
> **Troubleshooting**: If MongoDB is not running, the dev server (`npm run dev`) immediately terminates with exit code 1 and logs `MongoDB not reachable at <uri>. Start it with: docker start gohash-mongo`. Start the container with `docker start gohash-mongo`.

---

## Completed Sprints

### Blockchain Days 1–3 (Smart Contract Foundation)
- Authored and verified `DocumentNotary.sol` with document hash registration, notary attestation, revocation, and role-based permissions.
- Hardhat unit and integration test suites passing cleanly in PowerShell.
- Local deployment and account inspection scripts in `blockchain/scripts/`.

### Sprint 1A & 1B (Backend Foundation & JWT Authentication)
- Express + TypeScript architecture with fail-fast Zod environment parsing (`config/env.ts`).
- Mongoose schemas with validation and compound indexes: `User`, `Document`, `Notarization`.
- JWT authentication pipeline (`/api/auth/register`, `/api/auth/login`, `/api/auth/me`).
- Role-based authorization middleware (`USER`, `NOTARY`, `ADMIN`) and wallet update endpoint (`PATCH /api/auth/wallet`).

### Sprint 2A & 2B (Frontend Foundation & Auth UI Integration)
- Vite + React + TypeScript + Tailwind CSS (v3.4.19) application structure.
- Reusable UI kit: `Button`, `Card`, `StatCard`, `StatusBadge`, `EmptyState`, `Spinner`, `Alert`.
- Central API client (`lib/api.ts`) with envelope parsing, bearer token handling, and 401 redirection to `/login`.
- Strict route guards: `ProtectedRoute`, `RoleRoute` with dedicated `/403` Forbidden page and `/404` Not Found page.
- Landing page, Login page, and Registration page fully wired to backend auth APIs.

### Sprint 3A (Document Upload, Storage & Notarization Request)
- **Multer Memory Buffer**: Multipart file uploads with limits derived from `MAX_FILE_SIZE_MB`.
- **File Validation**: Strict `application/pdf` MIME check and `%PDF-` binary magic bytes verification; rejects invalid files with `400 INVALID_FILE`.
- **SHA-256 Hashing**: Computed via Node crypto buffer hashing (`services/hash.service.ts`).
- **Disk Storage**: Files saved to `backend/uploads/<documentId>.pdf` using generated document IDs; client filename preserved only as `originalName`.
- **Duplicate Document Guard**: Rejects identical uploads by the same owner with `409 DUPLICATE_DOCUMENT`.
- **Document Stats**: `GET /api/documents/stats` mounted before `/:id` returning `{ total, pending, notarized }`.
- **Cross-User Isolation**: `GET /api/documents/:id` and `GET /api/documents/:id/file` return `404 NOT_FOUND` for unauthorized callers so existence is not leaked.
- **Inline PDF Streaming**: `GET /api/documents/:id/file` streams PDF inline with proper headers.
- **Notarization Request**: `POST /api/notarization/request` allows owners of `PENDING` documents to request attestation (`status: "REQUESTED"`); duplicate requests rejected with `409 DUPLICATE_REQUEST`.
- **Smoke Tests**: 27/27 automated assertions passing in `backend/scripts/smoke-test.ts` with Mongo running.

### Sprint 3A-TESTFIX (Backend Test Isolation & Standalone Runner)
- **Port Isolation**: Smoke test runner imports `app` from `src/app.ts` and listens on an ephemeral free port (`listen(0)`), completely detached from the development server on `:5000`.
- **Database Isolation**: Connects to `MONGODB_URI_TEST` (`mongodb://localhost:27017/gohash_test`), guaranteeing no interference with development data. Enforces `_test` suffix safety check.
- **Fail-Fast Mongo Connectivity**: Replaced silent in-memory MongoDB fallback with an immediate fail-fast error directing the operator to start Docker Mongo (`docker start gohash-mongo`).
- **Clean Teardown**: Drops the `gohash_test` database at the start and end of test runs, and unlinks any test files written to `backend/uploads/`.
- **Error Stack Sanitization**: Removed `stack` traces from 500 error response bodies across all environments, logging stack traces exclusively to the server console.

### Sprint 3A-DBFIX (Dev Server Fail-Fast MongoDB & Test Route Removal)
- **Zero Silent Fallback**: Completely uninstalled `mongodb-memory-server` and stripped all in-memory fallback routines from `src/config/db.ts`. If MongoDB is down, `connectDB` throws `MongoDB not reachable at <uri>. Start it with: docker start gohash-mongo` with 5-second timeout, and `server.ts` logs that message and exits with code 1.
- **URI Credential Masking**: Automatically masks user credentials (`mongodb://user:***@host`) before logging connection errors.
- **Production Route Purge**: Removed test-only `/test-admin` route from `src/routes/auth.routes.ts`. The smoke test dynamically mounts a throwaway RBAC test route on the test express instance before listening.

### Sprint 3B (Frontend Document & Dashboard Real Backend Integration)
- **API Wrapper Extensions (`lib/api.ts`)**:
  - Implemented `upload()` using `XMLHttpRequest` with progress tracking (`onProgress`), FormData without hardcoded Content-Type headers, Authorization Bearer token attachment, and unified `ApiError` mapping.
  - Implemented `getBlob()` for authenticated streaming of binary PDF documents (`GET /api/documents/:id/file`) using the stored JWT.
- **Strict TypeScript API Contracts (`types/index.ts`)**:
  - Added `Document`, `DocumentStatus`, `DocumentStats`, `DocumentStatsResponse`, `DocumentListResponse`, `DocumentDetailResponse`, `DocumentUploadResponse`, and `NotarizationRequestResponse` matching actual backend controller responses.
- **Upload Page (`/upload`)**:
  - Client-side validation: PDF format and extension verification, 10MB size ceiling.
  - Interactive drag-and-drop zone with real progress tracking bar.
  - Server-computed SHA-256 hash display with one-click copy button, StatusBadge, "View document" link, and "Upload another" reset flow.
  - Error mapping from API codes: `INVALID_FILE` ("Not a valid PDF"), `FILE_TOO_LARGE` ("File exceeds 10 MB"), `DUPLICATE_DOCUMENT` ("You have already uploaded this exact file"). Zero client-side hashing (strictly server-side).
- **My Documents Library (`/documents`)**:
  - Full document table rendering original filename, truncated SHA-256 (`first 8...last 6`) with clipboard copy, status badge, formatted upload timestamp, and view action.
  - URL query-synced status filter (`?status=PENDING|APPROVED|REJECTED|NOTARIZED|All`).
  - Loading skeleton table, empty state with direct upload CTA, and error alert with retry button.
- **Document Detail Page (`/documents/:id`)**:
  - Full metadata inspection: document name, document ID, full SHA-256 with copy button, upload timestamp, status badge, and formatted file size.
  - Placeholder rows for Notary, Notary wallet, Timestamp, Transaction hash, Contract address, and IPFS CID displaying "Not notarized yet".
  - Authenticated "Open PDF" button streaming the document via `getBlob` and opening via `URL.createObjectURL` in a new tab with automatic 60s memory revocation.
  - "Request Notarization" workflow with confirmation dialog, POST `/api/notarization/request`, disabled button on in-flight or submitted request, and duplicate request detection (`409 DUPLICATE_REQUEST`).
  - Friendly 404 "Document not found" screen when non-existent or unauthorized.
- **Dashboard (`/dashboard`)**:
  - Exactly 3 StatCards connected to `GET /api/documents/stats`: Total Documents, Pending Notarization, Notarized (removed "Uploaded" card).
  - Skeletons during loading; retry button on error; no permanent "—".
  - 5 most recent documents displayed with status badges, truncated hash copy, and direct links.

### Sprint 4A (Blockchain Environment & Read-Only RPC Provider)
- Fixed TypeScript compilation errors in `blockchain/scripts/deploy-local.ts` and automated export of deployment artifact to `blockchain/deployments/localhost.json`.
- Implemented read-only JSON-RPC provider in backend (`services/blockchain.service.ts`) without any private keys or signer instances.
- Implemented cryptographic wallet link verification flow (`POST /api/auth/wallet/nonce` and `PATCH /api/auth/wallet`) utilizing `ethers.verifyMessage`.
- Implemented on-chain receipt verification (`BlockchainService.verifyReceipt`) auditing transaction status, contract address, document hash bytes32, and notary signer authorization.
- Added notarization workflow routes: `GET /api/notarization/pending`, `GET /api/notarization/:id`, `POST /api/notarization/:id/reject`, `POST /api/notarization/:id/approve`, and `POST /api/notarization/:id/confirm`.
- Added contract retrieval helper `BlockchainService.getContract()` defaulting to read-only provider (no backend signer) while permitting external runner attachment in integration tests.
- Standardized `GET /api/blockchain/:documentId` response payload to `{ document, stored, onChainRecord }`, eliminating duplicate fields.
- Verified `npm run test:chain` suite passes cleanly across repeat consecutive executions against the local node.

### Sprint 4B (Frontend MetaMask Integration & Notary On-Chain Attestation Flow)
- **Wallet Context (`context/WalletContext.tsx`)**:
  - Ethers v6 `BrowserProvider` connected over `window.ethereum`.
  - Account connection via `eth_requestAccounts`, silent auto-discovery via `eth_accounts`, and best-effort permission revocation on disconnect (`wallet_revokePermissions`).
  - Active network tracking and switching (`wallet_switchEthereumChain` with fallback to `wallet_addEthereumChain` on error 4902).
  - Robust event listeners for `accountsChanged` and `chainChanged` with clean unmount teardown.
  - Detailed error mapping: MetaMask not installed (direct link to metamask.io), user rejected (code 4001 / ACTION_REJECTED), and pending requests (-32002).
- **Wallet Navbar Control (`components/wallet/WalletButton.tsx`)**:
  - Integrated into both `Navbar.tsx` and authenticated `AppLayout.tsx`.
  - Shows formatted short address (`0x1234...5678`), live network dot, wrong-network warning badge with one-click chain switch, and dropdown menu with clipboard copy and disconnect.
- **Gas-Free Wallet Linking (`pages/user/ProfilePage.tsx`)**:
  - Available for all roles (`USER`, `NOTARY`, `ADMIN`).
  - Gas-free challenge nonce signing: calls `POST /api/auth/wallet/nonce`, prompts `signer.signMessage(message)`, and patches `PATCH /api/auth/wallet`.
  - Displays linked wallet status, clipboard copy, and mismatch warning if the connected MetaMask account differs from the linked GoHash account.
  - Explanatory copy: *"Signing this message is free. It does not send a transaction and GoHash never sees your private key."*
  - Error mapping for `WALLET_IN_USE` and `NONCE_INVALID` (with retry action).
- **Notary Review Dashboard (`pages/notary/NotaryDashboardPage.tsx`)**:
  - Role-guarded for `NOTARY` only.
  - Prominent warning banner when the notary has no linked wallet, directing them to the Profile page.
  - Table of pending requests with document name, owner identifier, truncated SHA-256 fingerprint with copy button, creation date, and direct review action.
- **Request Review & 5-Stage Approval State Machine (`pages/notary/NotaryRequestDetailPage.tsx`)**:
  - Full document metadata inspection and authenticated PDF preview via JWT blob streaming (`/api/documents/:id/file`).
  - Rejection modal requiring explicit justification reason (`POST /api/notarization/:id/reject`).
  - Explicit approval state machine:
    `idle` → `preparing` (`POST /api/notarization/:id/approve`) → `awaiting-wallet` (MetaMask popup) → `pending` (tx broadcasted & waiting for block) → `verifying` (`POST /api/notarization/:id/confirm`) → `confirmed` | `failed` | `rejected-by-user`.
  - Polling every 2s up to 30s on HTTP 202 `TX_PENDING`.
  - Prevents double-submission and disables action buttons while in progress.
  - Non-sensitive transaction hash persisted in `sessionStorage` (`notarization_tx_<id>`) enabling seamless "Confirm previous transaction" recovery upon browser refresh.
  - Server error code mapping: `NOTARY_NOT_AUTHORIZED_ON_CHAIN`, `OWNER_WALLET_REQUIRED`, `ALREADY_NOTARIZED`, `VERIFICATION_FAILED`.
- **Document Details Owner View (`pages/user/DocumentDetailPage.tsx`)**:
  - Populates on-chain notarization fields from `document.notarization`: Notary, Notary wallet, Timestamp, Transaction hash (with copy button), Block number, and Contract address.
  - Updates status badge to `NOTARIZED`.
  - Hides "Request Notarization" button once a notarization request exists.

---

## Remaining Backlog

### Sprint 5A (Public Independent Verification Engine)
- [ ] Implement `POST /api/verify`: accepts SHA-256 hash string or PDF file; verifies against database records and cross-checks on-chain smart contract data.
- [ ] Public Verification Page (`/verify`): search input by hash or file upload; displays tamper-evident attestation status, block number, and notary identity.

### Sprint 5B (Admin Management & Verifiable Certificates)
- [ ] Admin pages (`/admin/dashboard` & `/admin/notaries`): system overview metrics, notary promotion, and notary deactivation.
- [ ] Verifiable digital notarization certificate generation / export (PDF receipt summarizing on-chain attestation details).

### Sprint 5C (Metadata Visibility & Privacy Controls)
- [ ] Document visibility controls (`PUBLIC` vs `PRIVATE` off-chain metadata exposure).
- [ ] The document file is never public and never on-chain; "visibility" only controls which off-chain metadata a public verification result shows.

### Sprint 6A (Security Hardening & Production Polish)
- [ ] Rate limiting on authentication and upload endpoints.
- [ ] Helmet header fine-tuning, CORS verification, and input validation auditing.

### Sprint 6B (Documentation & Project Handoff)
- [ ] Finalize API contract and architecture documentation.
- [ ] End-to-end demonstration script and testing walkthrough.

---

## How to Run

### 1. Start MongoDB (Docker)
Ensure the MongoDB container is running:
```powershell
docker start gohash-mongo
# or using compose:
docker compose up -d
```

### 2. Run Backend
```powershell
cd backend
npm install
npm run dev
```
Backend runs at `http://localhost:5000` (API endpoint: `http://localhost:5000/api`).

### 3. Run Frontend
```powershell
cd frontend
npm install
npm run dev
```
Frontend runs at `http://localhost:5173`.

### 4. Verification Commands
```powershell
# Backend typecheck (0 errors)
cd backend
npm run typecheck

# Backend isolated smoke test (requires Docker Mongo running)
# Spawns isolated server on ephemeral port (listen(0)) and connects to MONGODB_URI_TEST (gohash_test)
npm run test:smoke

# Frontend build & lint
cd ../frontend
npm run lint
npm run build

# UI Wording & Forbidden Terms Audit (Must return 0 hits in frontend/src)
# Checks: "immutable", "unhackable", "admissible", "encrypt"
git grep -i -E "immutable|unhackable|admissible|encrypt" -- src
```

---

### 5. How to Run the Local Chain Demo

To execute the complete end-to-end notarization workflow with a local blockchain, follow these steps:

#### Step 1: Start Hardhat Local Blockchain Node
In a dedicated terminal:
```powershell
cd blockchain
npx hardhat node
```
This runs a local JSON-RPC Ethereum node at `http://127.0.0.1:8545` (Chain ID: `31337`).  
Keep note of **Account #0** (Deployer) and **Account #1** (Notary) printed in the console.

#### Step 2: Deploy Contract and Authorize Notary
In a second terminal:
```powershell
cd blockchain
npx hardhat run scripts/deploy-local.ts --network localhost
```
This deploys `DocumentNotary.sol`, authorizes Account #1 as a certified notary, and exports `blockchain/deployments/localhost.json`.

#### Step 3: Restart Backend and Start Frontend
If the Hardhat node was restarted or the contract redeployed, restart the backend server so it detects and loads the new `blockchain/deployments/localhost.json`:
- Terminal 3 (Backend):
  ```powershell
  cd backend
  npm run dev
  ```
- Terminal 4 (Frontend):
  ```powershell
  cd frontend
  npm run dev
  ```

#### Step 4: Configure MetaMask Network and Two Accounts
1. Open MetaMask in your browser.
2. Add a custom network:
   - **Network Name**: Hardhat Local
   - **RPC URL**: `http://127.0.0.1:8545`
   - **Chain ID**: `31337`
   - **Currency Symbol**: `ETH`
3. Import the two Hardhat accounts:
   - **Account #1 (Notary)**:
     - Address: `0x70997970C51812dc3A010C7d01b50e0d17dc79C8`
     - Private key from Hardhat node console: `<copy the Account #1 private key from the hardhat node output>`
   - **Account #2 (Regular User / Document Owner)**:
     - Address: `0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC`
     - Private key from Hardhat node console: `<copy the Account #2 private key from the hardhat node output>`

#### Step 5: End-to-End Walkthrough
1. **User Workflow**:
   - Navigate to `http://localhost:5173/register` and register as a regular user (e.g. Alice).
   - In MetaMask, switch to Alice's account (Account #2).
   - Go to `/profile`, click **Link MetaMask Wallet**, and sign the gas-free challenge message.
   - Go to `/upload`, upload a PDF document, and copy its computed SHA-256 hash.
   - Go to `/documents/:id`, click **Request Notarization**, and confirm the request. Status transitions to `REQUESTED`.
2. **Notary Workflow**:
   - Log out and log into a user with the `NOTARY` role (or promote a user).
   - In MetaMask, switch to the authorized Notary account (Account #1).
   - Go to `/profile`, click **Link MetaMask Wallet**, and sign the message to associate Account #1.
   - Navigate to `/notary/dashboard`. The document appears in the **Pending Requests Queue**.
   - Click **Review** to open `/notary/requests/:id`.
   - Click **Open PDF** to inspect the document via authenticated JWT streaming.
   - Click **Approve & Notarize**.
   - Observe the 5-stage state machine:
     `Preparing` → `MetaMask popup` → `Pending on-chain` → `Server verification` → `Confirmed`.
3. **Verify On-Chain Attestation**:
   - Log back into Alice's account and view `/documents/:id`.
   - Notice the status badge is updated to `NOTARIZED`.
   - The Blockchain & Notarization card now displays the Notary identity, Notary wallet, block timestamp, transaction hash, block number, and contract address.

---

### Sprint 5A & 5B (Verification API, Admin Management & Notarization Certificate)

- **Public Verification Pipeline (`/api/verify` & `/verify` page)**:
  - Server-side in-memory SHA-256 calculation; uploaded PDF files are never stored to disk or DB during verification.
  - Read-only on-chain verification using `DocumentNotary.exists()` and `DocumentNotary.getDocument()`.
  - Unmistakable UI states with `aria-live` announcement:
    - `VERIFIED`: green panel with checkmark, original document details, SHA-256 digest, notary wallet, block timestamp, transaction hash, block number, and contract address.
    - `TAMPERED / VERIFICATION FAILED`: red panel with cross icon, computed hash, and clear explanatory message.
  - Comprehensive error handling: `INVALID_FILE`, `FILE_TOO_LARGE`, `RATE_LIMITED` (HTTP 429), `CHAIN_UNREACHABLE`, and `CONTRACT_NOT_DEPLOYED`.
- **Admin Dashboard (`/admin/dashboard`)**:
  - Real-time aggregated statistics from `GET /api/admin/stats`: total users by role, notaries with linked wallets, documents by status, and notarization pipeline stages.
  - Recent activity feed from `GET /api/admin/activity` displaying the 50 most recent notarization events with live status badges.
- **Admin Notary & User Management (`/admin/notaries`)**:
  - Live table combining user directory with live on-chain authorization status from `GET /api/admin/notaries`.
  - Search and role filtering (`USER`, `NOTARY`, `ADMIN`).
  - Off-chain role promotion/demotion (`PATCH /api/admin/users/:id/role`) with confirmation dialogs and notice that role change does not affect smart contract authorization.
  - Account status toggling (`PATCH /api/admin/users/:id/status`) with immediate token invalidation for disabled users.
  - Self-modification guards: administrators cannot modify their own role or active status (mapped to `CANNOT_MODIFY_SELF`).
  - On-chain `Authorize` and `Revoke` functions through MetaMask:
    - Interacts directly with `addNotary(address)` and `removeNotary(address)` on `DocumentNotary.sol`.
    - Retrieves contract address and ABI dynamically from `GET /api/blockchain/contract` (zero hardcoding).
    - Validates connected wallet matches `contractOwner()` before initiating transactions.
    - Full transaction state machine (`awaiting-wallet` → `pending` → `confirmed` / `rejected-by-user` / `failed`) with automatic data refresh after block confirmation.
- **Official Notarization Certificate (`/documents/:id/certificate`)**:
  - Dedicated attestation certificate displaying document metadata, SHA-256 cryptographic digest, attesting notary wallet, on-chain block timestamp, transaction hash, block number, and smart contract address.
  - Status guard: renders friendly prompt with return link if the document is not yet notarized.
  - Formal disclaimer footer: "Technical integrity proof of this document's SHA-256 hash. Not a substitute for legally recognized notarization."
  - Print optimization: dedicated print stylesheet hiding navbar, sidebar, and controls, enabling clean single-page printing via `window.print()`.
  - "View Certificate" action button integrated into `DocumentDetailPage` for all `NOTARIZED` documents.

#### Sprint 5B Verification & Admin Demo Steps

##### Demo 1: Public Document Verification (`/verify`)
1. Open `http://localhost:5173/verify` in any browser (no authentication required).
2. Drag and drop the original PDF file that was previously notarized.
3. Click **Verify File**.
4. Observe the green **VERIFIED** panel showing the authentic SHA-256 digest, attesting notary wallet, block timestamp, transaction hash, block number, and contract address.
5. Click **Verify another file**.
6. Select any modified or un-notarized PDF file and click **Verify File**.
7. Observe the red **TAMPERED / VERIFICATION FAILED** panel showing the computed digest with the explanation that no matching record exists.

##### Demo 2: Admin Dashboard & On-Chain Notary Management (`/admin/dashboard`, `/admin/notaries`)
1. Log in with an administrator account (or use `admin@gohash.io`).
2. Navigate to `/admin/dashboard` and verify stat cards and recent notarization activity.
3. Navigate to `/admin/notaries`.
4. Locate a regular user with a linked wallet address, click **Change Role**, and promote them to `NOTARY`.
5. Notice the on-chain badge reads **Not authorized** because on-chain registration is distinct from off-chain roles.
6. Connect MetaMask using Account #0 (the contract deployer account: `0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266`).
7. Click **Authorize On-Chain** next to the notary.
8. Confirm the transaction in MetaMask.
9. Once confirmed, observe the badge update to green **Authorized** with data read directly from the blockchain.
10. Click **Revoke On-Chain**, approve the transaction, and observe the badge update back to **Not authorized**.

##### Demo 3: Notarization Certificate Export (`/documents/:id/certificate`)
1. Log in as the owner of a `NOTARIZED` document and open `/documents/:id`.
2. Click the new **View Certificate** button in the action bar.
3. Review the certificate layout showing the document name, ID, SHA-256 digest, notary wallet, block timestamp, transaction hash, and disclaimer.
4. Click **Print / Save as PDF**.
5. Observe in the print preview dialog that the top navbar, sidebar, buttons, and app layout controls are cleanly hidden, presenting a clean certificate suitable for archiving.

---

### Task F1 (Notary/Admin Access Fixes & On-Chain Authorize Modal)

- **Diagnosed and Resolved Role Guarding Defect**:
  - Pre-redesign shared routes (`/dashboard`, `/profile`, `/documents/:id`, `/upload`) were accessible to authenticated users across all roles, but the redesign erroneously wrapped them in `<RequireAuth role="USER">`.
  - In `Login.tsx`, successful notary authentication triggered `navigate("/dashboard")`, bouncing notaries to the `/403` page.
  - Resolved in `App.tsx` by introducing `DashboardRedirect` (routing `ADMIN` to `/admin/dashboard`, `NOTARY` to `/notary/dashboard`, and `USER` to `/dashboard`) and widening shared route access to `["USER", "NOTARY", "ADMIN"]`.
- **403 Forbidden Page**:
  - Displays signed-in role, required role(s), "Go to my dashboard" button routing dynamically based on role, and "Switch account" button.
- **Notary Wallet Link Flow & Connected vs Linked Wallet Display**:
  - On Notary Requests (`NotaryDashboard.tsx`) and Request Review (`RequestReview.tsx`), if the notary has no linked wallet, embedded the interactive wallet link flow instead of requiring manual profile navigation.
  - Implemented `formatWalletError` mapping `WALLET_IN_USE` / `WALLET_ALREADY_LINKED` to: *"This wallet is linked to another GoHash account. In MetaMask select the notary account, then try again."*
  - Added connected MetaMask account vs linked account display, emitting clear mismatch warnings when they differ.
- **Admin On-Chain Notary Management (`/admin/notaries`)**:
  - Authorize and Revoke buttons are enabled only for `NOTARY` accounts with a linked wallet; otherwise disabled with *"This notary must link a wallet first (Profile > Link wallet)."*
  - Authorize is disabled when `onChainAuthorized === true`; Revoke is disabled when `false`.
  - `ChainActionModal` runs all preconditions (MetaMask installed, target wallet valid, MetaMask connected, network check, contract owner check, current on-chain status) before stepper advances.
  - Precondition failures show ONE error card (*"Cannot start: ..."*) and set Step 1 to FAILED with remaining steps NOT STARTED.
  - Stepper timing strictly enforced: "Sign in wallet" is DONE only after MetaMask returns a transaction; "Record on-chain" is DONE only after mined; "Verify receipt" is DONE only after backend refresh.
  - Eliminated duplicate error cards and prevented false "Transaction failed / Nothing was recorded" alerts when no transaction was sent.

