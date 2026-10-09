# GoHash API Contract

This document serves as the single source of truth for the GoHash REST API specification across backend and frontend engineering.

---

## 📬 Standard Response Envelope

All API endpoints must conform to the standard response envelope. The frontend client expects this unified shape for state management, notifications, and error handling.

### Success Response Envelope (`2xx`)

```json
{
  "success": true,
  "...": "Endpoint-specific data fields are spread at top-level"
}
```

### Error Response Envelope (`4xx`, `5xx`)

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR | UNAUTHORIZED | FORBIDDEN | NOT_FOUND | DUPLICATE_KEY | INVALID_CREDENTIALS | NOT_IMPLEMENTED | INTERNAL_SERVER_ERROR",
    "message": "Human-readable explanation of the error",
    "details": "Optional array or object with granular validation details"
  }
}
```

---

## 🔒 Terminology & Interpretation Standards

All UI copy, API responses, error messages, code comments, and documentation must strictly adhere to the following rules:
1. **On-Chain Timestamps**: An on-chain timestamp strictly denotes that **"the hash was recorded no later than this time"**. In user interfaces, display this as **"Recorded on-chain at <time>"**. It does **not** signify document authorship or document creation time.
2. **Hashing vs. Encryption**: SHA-256 is a cryptographic hash digest, **not encryption**. Never describe hashing as encryption and never use the term `"encrypted hash"`.
3. **Approved Terminology**: Use `"Recorded on-chain at <time>"`, `"tamper-evident"`, `"independently verifiable"`, and `"proof-of-existence"`.
4. **Forbidden Terminology & Claims**: Never write `"immutable"`, `"unhackable"`, `"cannot be altered"`, `"court-admissible"`, `"admissible"`, or `"impossible collision"`. Never make any legal-validity claims.
5. **Document Privacy & Visibility**: The document file is **never public and never on-chain**. The `visibility` setting (`PUBLIC` vs `PRIVATE`, Sprint 5C) only controls which off-chain metadata a public verification result displays (e.g. original filename vs raw cryptographic attestation only).

---

## 📋 Endpoints Overview

| Method | Endpoint | Auth | Purpose | Status |
|:---|:---|:---:|:---|:---|
| `GET` | `/api/health` | Public | System uptime & MongoDB connection status | **IMPLEMENTED** |
| `POST` | `/api/auth/register` | Public | Register a new user account (role USER) | **IMPLEMENTED** |
| `POST` | `/api/auth/login` | Public | Authenticate user & return signed JWT | **IMPLEMENTED** |
| `GET` | `/api/auth/me` | JWT | Fetch authenticated user profile | **IMPLEMENTED** |
| `POST` | `/api/auth/wallet/nonce` | JWT | Generate one-time signed-message nonce for wallet link | **IMPLEMENTED** |
| `PATCH` | `/api/auth/wallet` | JWT | Link wallet via signed nonce (backend never holds keys) | **IMPLEMENTED** |
| `POST` | `/api/documents/upload` | JWT (USER) | Upload PDF file & compute SHA-256 hash | **IMPLEMENTED** |
| `GET` | `/api/documents/stats` | JWT (USER) | Aggregate document counts (total, pending, notarized) | **IMPLEMENTED** |
| `GET` | `/api/documents` | JWT (USER) | List user documents (newest first, optional ?status=) | **IMPLEMENTED** |
| `GET` | `/api/documents/:id` | JWT | Get single document metadata (owner, NOTARY, ADMIN) | **IMPLEMENTED** |
| `GET` | `/api/documents/:id/file` | JWT | Stream PDF document inline (owner, NOTARY, ADMIN) | **IMPLEMENTED** |
| `POST` | `/api/notarization/request` | JWT (USER) | Request notary attestation for a document | **IMPLEMENTED** |
| `GET` | `/api/notarization/pending` | JWT (NOTARY) | List pending notarization requests | PLANNED (Sprint 4B) |
| `POST` | `/api/notarization/:id/approve` | JWT (NOTARY) | Approve request and commit to blockchain | PLANNED (Sprint 4B) |
| `POST` | `/api/notarization/:id/reject` | JWT (NOTARY) | Reject notarization with reason | PLANNED (Sprint 4B) |
| `POST` | `/api/verify` | Public | Verify SHA-256 hash or document against blockchain | PLANNED (Sprint 5A) |
| `GET` | `/api/blockchain/:documentId` | Public | Retrieve raw on-chain notarization receipt | PLANNED (Sprint 4B) |

---

## 🛠 Endpoint Specifications

### 1. System Health

#### `GET /api/health`
- **Auth**: None
- **Request**: None
- **Status**: `IMPLEMENTED`
- **Success (200)**:
```json
{
  "success": true,
  "status": "ok",
  "uptime": 142.85,
  "timestamp": "2026-10-07T10:15:30.000Z",
  "db": {
    "state": 1,
    "status": "connected"
  }
}
```

---

### 2. Authentication & User Profile

#### `POST /api/auth/register`
- **Auth**: None
- **Request Body**:
```json
{
  "name": "Alice Doe",
  "email": "alice@example.com",
  "password": "Password123!",
  "confirmPassword": "Password123!"
}
```
> Note: Even if a `role` field is provided in the body, it is strictly ignored. All registrations are assigned `role: "USER"`.
- **Success (201)**:
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "67039a8c1719b2241cfb1234",
    "name": "Alice Doe",
    "email": "alice@example.com",
    "role": "USER",
    "walletAddress": null,
    "isActive": true
  }
}
```
- **Error Responses**:
  - `400 Bad Request` (`VALIDATION_ERROR`): Validation failed (e.g. password mismatch, password < 8 chars).
  - `409 Conflict` (`EMAIL_ALREADY_EXISTS`): An account with this email already exists.

#### `POST /api/auth/login`
- **Auth**: None
- **Request Body**:
```json
{
  "email": "alice@example.com",
  "password": "Password123!"
}
```
- **Success (200)**:
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "67039a8c1719b2241cfb1234",
    "name": "Alice Doe",
    "email": "alice@example.com",
    "role": "USER",
    "walletAddress": null,
    "isActive": true
  }
}
```
- **Error Responses**:
  - `401 Unauthorized` (`INVALID_CREDENTIALS`): Generic error returned for non-existent email, wrong password, or deactivated accounts.

#### `GET /api/auth/me`
- **Auth**: Bearer JWT (`Authorization: Bearer <token>`)
- **Request**: None
- **Success (200)**:
```json
{
  "success": true,
  "user": {
    "id": "67039a8c1719b2241cfb1234",
    "name": "Alice Doe",
    "email": "alice@example.com",
    "role": "USER",
    "walletAddress": null,
    "isActive": true,
    "createdAt": "2026-10-07T10:00:00.000Z",
    "updatedAt": "2026-10-07T10:00:00.000Z"
  }
}
```
- **Error Responses**:
  - `401 Unauthorized` (`UNAUTHORIZED`): Missing or invalid token.

#### `POST /api/auth/wallet/nonce`
- **Auth**: Bearer JWT
- **Request**: None (uses JWT identity)
- **Status**: `IMPLEMENTED`
- **Purpose**: Generate a one-time nonce message the client must sign with their wallet.
  The nonce is stored server-side (`select: false`) and is valid for **5 minutes**.
  Calling this endpoint again invalidates any previous nonce.
- **Success (200)**:
```json
{
  "success": true,
  "message": "GoHash wallet link\nUser: <userId>\nNonce: <32-hex-char random>\nExpires: <ISO-8601>",
  "expiresAt": "2026-10-09T12:35:00.000Z"
}
```
- **Error Responses**:
  - `401 Unauthorized` (`UNAUTHORIZED`): Missing or invalid token.

#### `PATCH /api/auth/wallet`
- **Auth**: Bearer JWT
- **Request Body** (signed-nonce flow — required after Sprint 4A):
```json
{
  "walletAddress": "0x70997970c51812dc3a010c7d01b50e0d17dc79c8",
  "signature": "0x..."
}
```
> **How the signature is produced**: The client calls `POST /api/auth/wallet/nonce` first,
> then signs the returned `message` string with their wallet (e.g. MetaMask `personal_sign` /
> ethers.js `signer.signMessage(message)`). Signing is gas-free and the backend never sees a private key.
- **Success (200)**:
```json
{
  "success": true,
  "user": {
    "id": "67039a8c1719b2241cfb1234",
    "name": "Alice Doe",
    "email": "alice@example.com",
    "role": "USER",
    "walletAddress": "0x70997970c51812dc3a010c7d01b50e0d17dc79c8",
    "isActive": true
  }
}
```
- **Error Responses**:
  - `400 Bad Request` (`VALIDATION_ERROR`): Wallet address must be `0x` followed by 40 hex digits.
  - `400 Bad Request` (`NONCE_INVALID`): No active nonce, or the nonce has expired / already been consumed.
  - `400 Bad Request` (`SIGNATURE_INVALID`): The recovered signer does not match `walletAddress`.
  - `409 Conflict` (`WALLET_IN_USE`): This wallet address is already linked to another account.

---

### 3. Documents
 
#### `POST /api/documents/upload`
- **Auth**: Bearer JWT (`USER`)
- **Content-Type**: `multipart/form-data`
- **Form Field**: `file` (or `document`)
- **Validation**:
  - File must be provided and <= `MAX_FILE_SIZE_MB` (default 10MB).
  - File must have MIME `application/pdf` AND start with magic bytes `"%PDF-"`.
- **Status**: `IMPLEMENTED`
- **Success (201)**:
```json
{
  "success": true,
  "document": {
    "id": "67039a8c1719b2241cfb5678",
    "originalName": "contract.pdf",
    "sha256Hash": "a1b2c3d4e5f6...",
    "status": "PENDING",
    "createdAt": "2026-10-08T10:00:00.000Z"
  }
}
```
- **Error Responses**:
  - `400 Bad Request` (`INVALID_FILE`): Missing file, non-PDF MIME type, or invalid `%PDF-` header.
  - `400 Bad Request` (`FILE_TOO_LARGE`): File exceeds configured maximum size.
  - `409 Conflict` (`DUPLICATE_DOCUMENT`): Document with same SHA-256 hash already uploaded by this owner.

#### `GET /api/documents/stats`
- **Auth**: Bearer JWT (`USER`)
- **Status**: `IMPLEMENTED`
- **Success (200)**:
```json
{
  "success": true,
  "total": 5,
  "pending": 3,
  "notarized": 2,
  "stats": {
    "total": 5,
    "pending": 3,
    "notarized": 2
  }
}
```

#### `GET /api/documents`
- **Auth**: Bearer JWT (`USER`)
- **Query Parameters**: `?status=PENDING|APPROVED|REJECTED|NOTARIZED` (optional)
- **Status**: `IMPLEMENTED`
- **Success (200)**:
```json
{
  "success": true,
  "documents": [
    {
      "id": "67039a8c1719b2241cfb5678",
      "originalName": "contract.pdf",
      "fileName": "67039a8c1719b2241cfb5678.pdf",
      "mimeType": "application/pdf",
      "fileSize": 1048576,
      "sha256Hash": "a1b2c3d4e5f6...",
      "visibility": "PRIVATE",
      "status": "PENDING",
      "ipfsCid": null,
      "createdAt": "2026-10-08T10:00:00.000Z",
      "updatedAt": "2026-10-08T10:00:00.000Z"
    }
  ]
}
```

#### `GET /api/documents/:id`
- **Auth**: Bearer JWT (`owner`, `NOTARY`, or `ADMIN`)
- **Status**: `IMPLEMENTED`
- **Success (200)**:
```json
{
  "success": true,
  "document": {
    "id": "67039a8c1719b2241cfb5678",
    "originalName": "contract.pdf",
    "fileName": "67039a8c1719b2241cfb5678.pdf",
    "mimeType": "application/pdf",
    "fileSize": 1048576,
    "sha256Hash": "a1b2c3d4e5f6...",
    "visibility": "PRIVATE",
    "status": "PENDING",
    "ipfsCid": null,
    "ownerId": "67039a8c1719b2241cfb1234",
    "createdAt": "2026-10-08T10:00:00.000Z",
    "updatedAt": "2026-10-08T10:00:00.000Z"
  }
}
```
- **Error Responses**:
  - `404 Not Found` (`NOT_FOUND`): Document does not exist or user is unauthorized (existence not leaked).

#### `GET /api/documents/:id/file`
- **Auth**: Bearer JWT (`owner`, `NOTARY`, or `ADMIN`)
- **Status**: `IMPLEMENTED`
- **Headers**:
  - `Content-Type`: `application/pdf`
  - `Content-Disposition`: `inline; filename="contract.pdf"`
- **Response**: Binary stream of the stored PDF file.
- **Error Responses**:
  - `404 Not Found` (`NOT_FOUND`): Document does not exist or unauthorized.

---

### 4. Notarization Workflows

#### `POST /api/notarization/request`
- **Auth**: Bearer JWT (`USER` owner only)
- **Request Body**:
```json
{
  "documentId": "67039a8c1719b2241cfb5678"
}
```
- **Validation**: Document must be owned by authenticated user, be in `PENDING` status, and have no active request.
- **Status**: `IMPLEMENTED`
- **Success (201)**:
```json
{
  "success": true,
  "notarization": {
    "id": "67039a8c1719b2241cfb9999",
    "documentId": "67039a8c1719b2241cfb5678",
    "status": "REQUESTED",
    "documentHash": "a1b2c3d4e5f6...",
    "requestedBy": "67039a8c1719b2241cfb1234",
    "createdAt": "2026-10-08T10:05:00.000Z"
  }
}
```
- **Error Responses**:
  - `400 Bad Request` (`VALIDATION_ERROR`): Missing `documentId`.
  - `400 Bad Request` (`INVALID_STATUS`): Document is not in `PENDING` status.
  - `404 Not Found` (`NOT_FOUND`): Document not found or not owned by user.
  - `409 Conflict` (`DUPLICATE_REQUEST`): Active notarization request already exists.

#### `GET /api/notarization/pending`
- **Auth**: Bearer JWT (Role: `NOTARY` or `ADMIN`)
- **Status**: `PLANNED - Sprint 4B` (Returns HTTP 501 `NOT_IMPLEMENTED`)

#### `POST /api/notarization/:id/approve`
- **Auth**: Bearer JWT (Role: `NOTARY`)
- **Status**: `PLANNED - Sprint 4B` (Returns HTTP 501 `NOT_IMPLEMENTED`)

#### `POST /api/notarization/:id/reject`
- **Auth**: Bearer JWT (Role: `NOTARY`)
- **Status**: `PLANNED - Sprint 4B` (Returns HTTP 501 `NOT_IMPLEMENTED`)

---

### 5. Verification & Blockchain (PLANNED - Sprint 4B & 5A)

#### `POST /api/verify`
- **Auth**: None
- **Status**: `PLANNED - Sprint 5A` (Returns HTTP 501 `NOT_IMPLEMENTED`)

#### `GET /api/blockchain/:documentId`
- **Auth**: None
- **Status**: `PLANNED - Sprint 4B` (Returns HTTP 501 `NOT_IMPLEMENTED`)
