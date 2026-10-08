# GoHash Project Progress

## Status Table

| Milestone | Scope | Status | Notes |
| :--- | :--- | :---: | :--- |
| **Blockchain Days 1–3** | `blockchain/` (Smart contract foundation & tests) | **Complete** | `DocumentNotary.sol` implemented; unit & integration tests passing |
| **Sprint 1A & 1B** | `backend/` (Express foundation & JWT auth / RBAC) | **Complete** | Mongoose models, Zod validation, JWT auth, role middleware |
| **Sprint 2A & 2B** | `frontend/` (Layout shell & Auth UI integration) | **Complete** | Dark theme UI kit, route guards, `/login`, `/register`, `/403` |
| **Sprint 3A** | `backend/` (Document upload, hashing & request) | **Complete** | 27/27 smoke assertions passing with Docker Mongo running |
| **Sprint 3A-TESTFIX** | `backend/` (Test isolation & standalone runner) | **Complete** | Ephemeral port isolation, test DB isolation, fail-fast Mongo check |
| **Sprint 3B** | `frontend/` (Document upload & management pages) | **Not Started** | Upload page, document table, and 3 dashboard stat cards |
| **Sprint 4A & 4B** | Full-stack (Blockchain integration & notary actions) | **Pending** | Local node deployment, read-only RPC, MetaMask signing |
| **Sprint 5A & 5B** | Full-stack (Verification engine, admin & certificate) | **Pending** | Public `/api/verify`, admin management, verifiable certificate |
| **Sprint 6A & 6B** | Full-stack (Security hardening & final documentation)| **Pending** | Rate limiting, audit, and project presentation package |

---

## Locked Decisions

1. **Backend Key Security**: The backend never holds any private key (deployer or notary). The NOTARY signs the notarize transaction in MetaMask in the browser. The backend utilizes a READ-ONLY JSON-RPC provider. After the browser sends the transaction hash to the backend, the backend verifies the receipt on-chain (transaction success, correct contract address, matching document hash, and verifying that the on-chain signer matches the notary's registered wallet) before marking the document status as `NOTARIZED`.
2. **Server-Side Hashing Only**: SHA-256 is computed on the server only. The frontend never uses the Web Crypto API or hashes files client-side; it displays the hash returned by the API.
3. **Off-Chain Document Storage**: The PDF is never stored on-chain. Only the cryptographic SHA-256 hash, timestamp, and verification metadata are committed to the blockchain.
4. **Database Environment**: Local MongoDB runs in Docker (container name `gohash-mongo`, host port `27017`).
5. **Project Terminology & Framing**: The system is framed as providing **tamper-evident** and **independently verifiable** proof-of-existence. The system is never described as "100% immutable" or as something that "replaces legal notaries".

---

## Docker Setup

### Overview
Local database services run through Docker container `gohash-mongo` using the official `mongo:latest` image.

- **Start Command**: `docker start gohash-mongo` (or `docker compose up -d`)
- **Stop Command**: `docker stop gohash-mongo` (or `docker compose down`)
- **Database Connection URI**: `mongodb://localhost:27017/gohash` (exact value from `backend/.env.example`)
- **Persistence**: Data persists in the named Docker volume `mongo-data` (destination `/data/db`).

### Troubleshooting
> **Troubleshooting**: Backend returns 500 / health shows db state 0 -> run `docker ps`; if gohash-mongo is not running, `docker start gohash-mongo`.

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

---

## Remaining Backlog

### Sprint 3B (Frontend Document & Dashboard Pages)
- [ ] **Document Upload Page (`/upload`)**: Drag-and-drop PDF upload component sending multipart data to `POST /api/documents/upload`; displays server-computed SHA-256 hash.
- [ ] **User Dashboard (`/dashboard`)**: Connect 3 stats cards matching `GET /api/documents/stats`: `Total`, `Pending`, `Notarized`.
- [ ] **Documents Library (`/documents`)**: Document list and table with status badges (`PENDING`, `APPROVED`, `REJECTED`, `NOTARIZED`), search, and status filter.
- [ ] **Document Detail (`/documents/:id`)**: Document inspection view displaying hash, timestamp, status, and inline PDF view (`/api/documents/:id/file`).
- [ ] **Profile Page (`/profile`)**: User information display and MetaMask wallet connection triggering `PATCH /api/auth/wallet`.

### Sprint 4A (Blockchain Environment & Read-Only RPC Provider)
- [ ] Fix 2 TypeScript compilation errors in `blockchain/scripts/deploy-local.ts`.
- [ ] Run Hardhat local node and deploy `DocumentNotary.sol` to record contract address.
- [ ] Implement backend read-only JSON-RPC provider in `backend/src/services/blockchain.service.ts` using `ethers.JsonRpcProvider`.

### Sprint 4B (Notary Review & On-Chain Verification Workflow)
- [ ] Implement `GET /api/notarization/pending` for notary review queue.
- [ ] Notary UI (`/notary/dashboard` and `/notary/requests/:id`): review document details and inline PDF.
- [ ] MetaMask attestation signing in browser: Notary signs `notarizeDocument()` transaction.
- [ ] Implement `POST /api/notarization/:id/approve`: browser passes txHash; backend inspects on-chain receipt (verifies transaction success, matching contract address, matching document hash, and verifying that the signer matches the notary's wallet) before marking `NOTARIZED`.
- [ ] Implement `POST /api/notarization/:id/reject`: records rejection reason and marks document `REJECTED`.
- [ ] Implement `GET /api/blockchain/:documentId`: queries smart contract state for raw attestation receipt.

### Sprint 5A (Public Independent Verification Engine)
- [ ] Implement `POST /api/verify`: accepts SHA-256 hash string or PDF file; verifies against database records and cross-checks on-chain smart contract data.
- [ ] Public Verification Page (`/verify`): search input by hash or file upload; displays tamper-evident attestation status, block number, and notary identity.

### Sprint 5B (Admin Management & Verifiable Certificates)
- [ ] Admin pages (`/admin/dashboard` & `/admin/notaries`): system overview metrics, notary promotion, and notary deactivation.
- [ ] Verifiable digital notarization certificate generation / export (PDF receipt summarizing on-chain attestation details).

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
```

---

## Known Issues

1. **`blockchain/scripts/deploy-local.ts` TypeScript Errors**: Contains 2 TypeScript errors on lines 55 and 65 (`Property 'addNotary' does not exist on type 'BaseContract'` and `Property 'notarize' does not exist on type 'BaseContract'`), to be fixed prior to Sprint 4.
2. **Headless Browser Driver in Sandbox**: Playwright driver binary auto-download encounters network restrictions in sandbox; manual browser testing at `http://localhost:5173` is used.
3. **LocalStorage JWT Storage**: Storing JWT in `localStorage` requires rigorous XSS protections (strictly avoiding `dangerouslySetInnerHTML`). For production deployment, httpOnly cookies are recommended.
