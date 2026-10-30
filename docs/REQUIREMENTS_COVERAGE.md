# GoHash — Requirements Coverage

> **Status legend:**
> - **Done** — covered by an automated test (test name listed in Evidence).
> - **Built** — implemented in code but not covered by an automated test (UI-only or manual verification).
> - **Not built** — planned but not implemented in this prototype.

---

## Objectives

| # | Objective | Status | Evidence (test / file) | Manual browser check |
|:--|:----------|:------:|:-----------------------|:---------------------|
| 1 | Web platform for digital document notarization | Built | `frontend/client/App.tsx`; `backend/src/app.ts` | |
| 2 | SHA-256 cryptographic hash computed server-side | Done | `smoke-test.ts` — upload returns sha256Hash; `chain-test.ts` — hash used in approve/confirm | |
| 3 | Tamper-evident blockchain records | Done | `chain-test.ts` — "real flow: on-chain notarize → confirm → CONFIRMED"; RBAC EP 20 VERIFIED | |
| 4 | Smart contracts for authorized notarization and verification | Done | `blockchain/test/` — 128 assertions (notarize, addNotary, isNotary, verify, exists) | |
| 5 | Separate interfaces for users, notaries, and admins | Built | `frontend/client/pages/`, `frontend/client/App.tsx`; role guards | |
| 6 | Verification by comparing SHA-256 hashes | Done | `chain-test.ts` — "POST /api/verify: real PDF → VERIFIED"; "modified PDF → NOT_VERIFIED" | |
| 7 | Document metadata stored in a database | Done | `smoke-test.ts` — upload, list, detail assertions; Mongoose `Document` model | |
| 8 | Transparency and traceability | Done | `chain-test.ts` — GET /api/blockchain/:documentId returns on-chain record; certificate page | |

---

## Modules

| # | Module | Status | Evidence (test / file) | Manual browser check |
|:--|:-------|:------:|:-----------------------|:---------------------|
| 6.1 | Authentication (register, login, JWT, roles) | Done | `smoke-test.ts` auth block (register, login, me, 401 guard); `rbac-test.ts` EP 1–5 | |
| 6.2 | Document upload and server-side SHA-256 hashing | Done | `smoke-test.ts` upload assertions; `chain-test.ts` EP 7 | |
| 6.3 | Notarization request management | Done | `smoke-test.ts` notarization request; `rbac-test.ts` EP 12 PENDING/REQUESTED/DUPLICATE | |
| 6.4 | Notary dashboard (queue, approve, reject) | Built | `chain-test.ts` — approve preconditions + reject reason; `NotaryDashboardPage.tsx`, `NotaryRequestDetailPage.tsx` | |
| 6.5 | Smart contract integration (backend ↔ chain) | Done | `chain-test.ts` — full approve→confirm flow; receipt verification edge cases | |
| 6.6 | Public verification endpoint | Done | `chain-test.ts` — VERIFIED / NOT_VERIFIED / INVALID_FILE / no-auth tests; `rbac-test.ts` EP 20 | |
| 6.7 | Metadata storage (MongoDB) | Done | `smoke-test.ts`; `rbac-test.ts` — admin stats counts correct | |
| 6.7b | IPFS decentralized document storage | Not built | `ipfsCid` sent as `""` in all calls; field exists in contract | |
| 6.8 | Administration panel | Done | `chain-test.ts` — admin routes 403/200, stats counts, disabled user 403, self-modify guard; `rbac-test.ts` EP 21–26 | |

---

## Working Method Steps

| Step | Description | Status | Evidence | Manual browser check |
|:-----|:------------|:------:|:---------|:---------------------|
| 1 | Define system requirements and roles | Done | `docs/PROGRESS.md`, `docs/API_CONTRACT.md` | |
| 2 | Design smart contract (`DocumentNotary.sol`) | Done | `blockchain/contracts/DocumentNotary.sol`; 128 Hardhat tests | |
| 3 | Set up Hardhat local chain and deploy | Done | `blockchain/scripts/deploy-local.ts`; `deployments/localhost.json` | |
| 4 | Build backend REST API (Express + Mongoose) | Done | `backend/src/`; `smoke-test.ts` 27 assertions | |
| 5 | Implement JWT auth and RBAC | Done | `smoke-test.ts` auth block; `rbac-test.ts` 26-endpoint matrix | |
| 6 | Implement document upload and server-side SHA-256 | Done | `smoke-test.ts` upload; `backend/src/services/hash.service.ts` | |
| 7 | Implement notarization workflow (approve / confirm / reject) | Done | `chain-test.ts` 31 assertions including receipt edge cases | |
| 8 | Build React frontend with role-guarded routes | Built | `frontend/client/App.tsx`; `frontend/client/pages/` | |
| 9 | Integrate MetaMask (wallet link + notarize tx) | Built | `WalletContext.tsx`; `NotaryRequestDetailPage.tsx` 5-step machine | |
| 10 | Implement public verification and admin management | Done | `chain-test.ts` verify block; `rbac-test.ts` admin endpoints | |
| 11 | Security hardening and documentation | Done | `rbac-test.ts` RBAC matrix + sensitive-field check; Helmet, CORS, rate limiting in `backend/src/app.ts`; `docs/` | |
