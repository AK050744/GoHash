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
| `GET` | `/api/auth/config` | Public | Public Google OAuth client config & feature toggle | **IMPLEMENTED** |
| `POST` | `/api/auth/register` | Public | Register a new user account (role USER) | **IMPLEMENTED** |
| `POST` | `/api/auth/login` | Public | Authenticate user & return signed JWT | **IMPLEMENTED** |
| `POST` | `/api/auth/google` | Public | Authenticate via Google ID-token (ID-token flow) | **IMPLEMENTED** |
| `POST` | `/api/auth/google/link` | JWT | Link Google identity to authenticated account | **IMPLEMENTED** |
| `GET` | `/api/auth/me` | JWT | Fetch authenticated user profile | **IMPLEMENTED** |
| `POST` | `/api/auth/wallet/nonce` | JWT | Generate one-time signed-message nonce for wallet link | **IMPLEMENTED** |
| `PATCH` | `/api/auth/wallet` | JWT | Link wallet via signed nonce (backend never holds keys) | **IMPLEMENTED** |
| `POST` | `/api/documents/upload` | JWT | Upload PDF file & compute SHA-256 hash (USER, NOTARY, ADMIN) | **IMPLEMENTED** |
| `GET` | `/api/documents/stats` | JWT | Aggregate document counts (total, pending, notarized) | **IMPLEMENTED** |
| `GET` | `/api/documents` | JWT | List user documents (newest first, optional ?status=) | **IMPLEMENTED** |
| `GET` | `/api/documents/:id` | JWT | Get single document metadata (owner, NOTARY, ADMIN) | **IMPLEMENTED** |
| `GET` | `/api/documents/:id/file` | JWT | Stream PDF document inline (owner, NOTARY, ADMIN) | **IMPLEMENTED** |
| `POST` | `/api/notarization/request` | JWT | Request notary attestation for an owned document (USER, NOTARY, ADMIN) | **IMPLEMENTED** |
| `GET` | `/api/notarization/pending` | JWT (NOTARY) | List pending notarization requests | **IMPLEMENTED** |
| `GET` | `/api/notarization` | JWT | List own notarization requests (newest first, optional ?status=) | **IMPLEMENTED** |
| `GET` | `/api/notarization/:id` | JWT | Get single notarization details (owner, NOTARY, ADMIN) | **IMPLEMENTED** |
| `POST` | `/api/notarization/:id/approve` | JWT (NOTARY) | Validate preconditions and prepare on-chain notarize call | **IMPLEMENTED** |
| `POST` | `/api/notarization/:id/reject` | JWT (NOTARY) | Reject notarization with reason | **IMPLEMENTED** |
| `POST` | `/api/notarization/:id/confirm` | JWT (NOTARY) | Verify on-chain transaction receipt & confirm notarization | **IMPLEMENTED** |
| `POST` | `/api/notarization/:id/payment` | JWT (USER) | Submit fee payment in test ETH verified on-chain | **IMPLEMENTED** |
| `GET` | `/api/config/fees` | Public | Public fee configuration (test ETH on local chain) | **IMPLEMENTED** |
| `GET` | `/api/blockchain/contract` | JWT (ADMIN) | Smart contract address, chainId, and full ABI for wallet operations | **IMPLEMENTED** |
| `GET` | `/api/blockchain/:documentId` | JWT | Retrieve stored and on-chain notarization receipt | **IMPLEMENTED** |
| `POST` | `/api/verify` | Public | Verify PDF document against blockchain without storing file | **IMPLEMENTED** |
| `GET` | `/api/verify/hash/:sha256` | Public | Verify SHA-256 hash string directly against blockchain | **IMPLEMENTED** |
| `GET` | `/api/verify/key/:key` | Public | Look up notarization existence via unique key | **IMPLEMENTED** |
| `GET` | `/api/admin/users` | JWT (ADMIN) | List users with optional role and name/email query | **IMPLEMENTED** |
| `PATCH` | `/api/admin/users/:id/role` | JWT (ADMIN) | Change user role (USER, NOTARY, ADMIN) | **IMPLEMENTED** |
| `PATCH` | `/api/admin/users/:id/status` | JWT (ADMIN) | Enable or disable user account (immediate JWT invalidation) | **IMPLEMENTED** |
| `GET` | `/api/admin/notaries` | JWT (ADMIN) | List NOTARY users with live on-chain authorization status | **IMPLEMENTED** |
| `GET` | `/api/admin/activity` | JWT (ADMIN) | List latest 50 notarization activities (newest first) | **IMPLEMENTED** |
| `GET` | `/api/admin/stats` | JWT (ADMIN) | Aggregate system-wide counts and statistics (including fees) | **IMPLEMENTED** |

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

#### `GET /api/auth/config`
- **Auth**: None (Public)
- **Request**: None
- **Status**: `IMPLEMENTED`
- **Purpose**: Exposes whether Google ID-token authentication is enabled and returns the public Google Client ID when configured.
- **Success (200 - Enabled)**:
```json
{
  "success": true,
  "googleEnabled": true,
  "googleClientId": "911792744904-i1c3ichdrhqo63vk82ugf51d8jg7viji.apps.googleusercontent.com"
}
```
- **Success (200 - Disabled)**:
```json
{
  "success": true,
  "googleEnabled": false
}
```

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
    "isActive": true,
    "authProviders": ["PASSWORD"],
    "googleLinked": false
  }
}
```
- **Error Responses**:
  - `400 Bad Request` (`VALIDATION_ERROR`): Validation failed (e.g. password mismatch, password < 8 chars).
  - `409 Conflict` (`EMAIL_ALREADY_EXISTS`): An account with this email already exists.
  - `429 Too Many Requests` (`RATE_LIMITED`): Auth rate limit exceeded.

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
    "isActive": true,
    "authProviders": ["PASSWORD"],
    "googleLinked": false
  }
}
```
- **Error Responses**:
  - `401 Unauthorized` (`INVALID_CREDENTIALS`): Generic error returned for non-existent email, wrong password, Google-only account without passwordHash, or deactivated accounts.
  - `429 Too Many Requests` (`RATE_LIMITED`): Auth rate limit exceeded.

#### `POST /api/auth/google`
- **Auth**: None (Public)
- **Rate Limit**: Shared with `/api/auth/login` and `/api/auth/register` (`AUTH_RATE_LIMIT_MAX` per window).
- **Request Body**:
```json
{
  "credential": "<Google ID Token>"
}
```
- **Verification & Business Rules**:
  - If `GOOGLE_CLIENT_ID` is unset -> `503 GOOGLE_AUTH_DISABLED`.
  - Verified with `google-auth-library` (`verifyIdToken`). Any verification failure -> generic `401 GOOGLE_TOKEN_INVALID` with no internal details leaked.
  - `email_verified` must be `true` -> else `401 GOOGLE_EMAIL_NOT_VERIFIED`.
  - Google must be authoritative: email ends with `@gmail.com` (case-insensitive) OR `hostedDomain` is set -> else `403 GOOGLE_EMAIL_NOT_SUPPORTED` (`"Use a Gmail or Google Workspace account."`).
  - If a user with this `googleId` exists:
    - If `isActive: false` -> `403 ACCOUNT_DISABLED`.
    - Otherwise -> `200 OK` with `{ success: true, token, user }` (identical shape & expiry to password login).
  - If no `googleId` match, but a user with the same email exists:
    - Returns `409 ACCOUNT_EXISTS_USE_PASSWORD` (`"An account with this email already exists. Sign in with your password, then link Google in your profile."`). **Never auto-links by email**.
  - Otherwise creates a new user:
    - `name` from Google (fallback: email local part), lowercase `email`, `googleId` (`select: false`), `authProviders: ["GOOGLE"]`, `role: "USER"`, `isActive: true`.
    - Returns `201 Created` with `{ success: true, token, user }`. Handles duplicate-key races safely by re-reading the user.
    - Role is always taken from database; a Google sign-in can never create `NOTARY` or `ADMIN`.
- **Success (200 / 201)**:
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "67039a8c1719b2241cfb1234",
    "name": "Alice Doe",
    "email": "alice@gmail.com",
    "role": "USER",
    "walletAddress": null,
    "isActive": true,
    "authProviders": ["GOOGLE"],
    "googleLinked": true
  }
}
```
- **Error Responses**:
  - `400 Bad Request` (`VALIDATION_ERROR`): Missing credential.
  - `401 Unauthorized` (`GOOGLE_TOKEN_INVALID`): Invalid or unverified Google token.
  - `401 Unauthorized` (`GOOGLE_EMAIL_NOT_VERIFIED`): Google account email has not been verified.
  - `403 Forbidden` (`GOOGLE_EMAIL_NOT_SUPPORTED`): Email is neither Gmail nor Google Workspace.
  - `403 Forbidden` (`ACCOUNT_DISABLED`): Account has been disabled by an administrator.
  - `409 Conflict` (`ACCOUNT_EXISTS_USE_PASSWORD`): Account exists with this email; must login with password first.
  - `429 Too Many Requests` (`RATE_LIMITED`): Auth rate limit exceeded.
  - `503 Service Unavailable` (`GOOGLE_AUTH_DISABLED`): Google authentication is not enabled on this server.

#### `POST /api/auth/google/link`
- **Auth**: Bearer JWT (`Authorization: Bearer <token>`)
- **Request Body**:
```json
{
  "credential": "<Google ID Token>"
}
```
- **Rules**:
  - Uses identical Google ID-token verification rules as `/api/auth/google`.
  - The Google account email may differ from the GoHash account email.
  - If `googleId` is already used by another user -> `409 GOOGLE_ALREADY_LINKED`.
  - If current user already has a different `googleId` -> `409 ALREADY_LINKED`.
  - If current user links the same `googleId` again -> idempotent `200 OK`.
  - On success, adds `GOOGLE` to `authProviders` and returns the updated user profile.
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
    "authProviders": ["PASSWORD", "GOOGLE"],
    "googleLinked": true
  }
}
```
- **Error Responses**:
  - `401 Unauthorized` (`UNAUTHORIZED`): Missing or invalid JWT.
  - `401 Unauthorized` (`GOOGLE_TOKEN_INVALID`): Invalid Google token.
  - `401 Unauthorized` (`GOOGLE_EMAIL_NOT_VERIFIED`): Google email is not verified.
  - `403 Forbidden` (`GOOGLE_EMAIL_NOT_SUPPORTED`): Email is not Gmail or Google Workspace.
  - `409 Conflict` (`GOOGLE_ALREADY_LINKED`): This Google account is already linked to another GoHash account.
  - `409 Conflict` (`ALREADY_LINKED`): A different Google account is already linked to this profile.
  - `503 Service Unavailable` (`GOOGLE_AUTH_DISABLED`): Google authentication is disabled.

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
    "authProviders": ["PASSWORD"],
    "googleLinked": false,
    "createdAt": "2026-10-07T10:00:00.000Z",
    "updatedAt": "2026-10-07T10:00:00.000Z"
  }
}
```
- **Error Responses**:
  - `401 Unauthorized` (`UNAUTHORIZED`): Missing or invalid token.
  - `403 Forbidden` (`ACCOUNT_DISABLED`): Account has been disabled.

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
    "isActive": true,
    "authProviders": ["PASSWORD"],
    "googleLinked": false
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
- **Auth**: Bearer JWT (Role: `USER`, `NOTARY`, or `ADMIN`)
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
    "status": "NOTARIZED",
    "ipfsCid": null,
    "ownerId": "67039a8c1719b2241cfb1234",
    "createdAt": "2026-10-08T10:00:00.000Z",
    "updatedAt": "2026-10-08T10:00:00.000Z",
    "notarization": {
      "id": "67039a8c1719b2241cfb9999",
      "status": "CONFIRMED",
      "transactionHash": "0x4f8a12...",
      "blockNumber": 12,
      "notaryWallet": "0x70997970c51812dc3a010c7d01b50e0d17dc79c8",
      "contractAddress": "0x5FbDB2315678afecb367f032d93F642f64180aa3",
      "timestamp": 1728472500,
      "rejectionReason": null
    }
  }
}
```
> Note: When not notarized, `notarization` is `null`. The on-chain `timestamp` indicates that the hash was recorded no later than this time.
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
- **Auth**: Bearer JWT (Document owner: `USER`, `NOTARY`, or `ADMIN`)
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
- **Status**: `IMPLEMENTED`
- **Purpose**: List all notarization requests currently in `REQUESTED` status.
- **Success (200)**:
```json
{
  "success": true,
  "notarizations": [
    {
      "id": "67039a8c1719b2241cfb9999",
      "documentId": "67039a8c1719b2241cfb5678",
      "requestedBy": "67039a8c1719b2241cfb1234",
      "notaryId": null,
      "notaryWallet": null,
      "documentHash": "a1b2c3d4e5f6...",
      "transactionHash": null,
      "blockNumber": null,
      "contractAddress": null,
      "chainId": null,
      "onChainTimestamp": null,
      "rejectionReason": null,
      "failureReason": null,
      "status": "REQUESTED",
      "createdAt": "2026-10-08T10:05:00.000Z",
      "updatedAt": "2026-10-08T10:05:00.000Z",
      "document": {
        "id": "67039a8c1719b2241cfb5678",
        "originalName": "contract.pdf",
        "sha256Hash": "a1b2c3d4e5f6...",
        "createdAt": "2026-10-08T10:00:00.000Z"
      },
      "owner": {
        "name": "Alice Doe"
      }
    }
  ]
}
```
> Note: For privacy, `owner` strictly exposes `{ name }` and never includes email.
- **Error Responses**:
  - `401 Unauthorized` (`UNAUTHORIZED`): Missing or invalid token.
  - `403 Forbidden` (`FORBIDDEN`): User does not possess the `NOTARY` or `ADMIN` role.

#### `GET /api/notarization`
- **Auth**: Bearer JWT (`USER`, `NOTARY`, or `ADMIN`)
- **Status**: `IMPLEMENTED`
- **Purpose**: List all notarization requests submitted by the authenticated user (newest first), with populated document details.
- **Query Parameters**:
  - `status` (optional): Filter requests by status (`REQUESTED`, `APPROVED`, `CONFIRMED`, `REJECTED`, `FAILED`).
- **Success (200)**:
```json
{
  "success": true,
  "notarizations": [
    {
      "id": "67039a8c1719b2241cfb9999",
      "documentId": "67039a8c1719b2241cfb5678",
      "requestedBy": "67039a8c1719b2241cfb1234",
      "notaryId": "67039a8c1719b2241cfb7777",
      "notaryWallet": "0x70997970c51812dc3a010c7d01b50e0d17dc79c8",
      "documentHash": "a1b2c3d4e5f6...",
      "transactionHash": "0x4f8a12...",
      "blockNumber": 12,
      "contractAddress": "0x5FbDB2315678afecb367f032d93F642f64180aa3",
      "chainId": 31337,
      "onChainTimestamp": 1728472500,
      "rejectionReason": null,
      "failureReason": null,
      "status": "CONFIRMED",
      "createdAt": "2026-10-08T10:05:00.000Z",
      "updatedAt": "2026-10-08T10:06:00.000Z",
      "document": {
        "id": "67039a8c1719b2241cfb5678",
        "originalName": "contract.pdf",
        "sha256Hash": "a1b2c3d4e5f6...",
        "createdAt": "2026-10-08T10:00:00.000Z"
      },
      "owner": {
        "name": "Alice Doe"
      }
    }
  ]
}
```
- **Error Responses**:
  - `401 Unauthorized` (`UNAUTHORIZED`): Missing or invalid token.
  - `400 Bad Request` (`VALIDATION_ERROR`): Invalid `status` query parameter.

#### `GET /api/notarization/:id`
- **Auth**: Bearer JWT (`NOTARY`, `ADMIN`, or the requesting document owner)
- **Status**: `IMPLEMENTED`
- **Purpose**: Retrieve details of a single notarization record.
- **Success (200)**:
```json
{
  "success": true,
  "notarization": {
    "id": "67039a8c1719b2241cfb9999",
    "documentId": "67039a8c1719b2241cfb5678",
    "requestedBy": "67039a8c1719b2241cfb1234",
    "notaryId": "67039a8c1719b2241cfb7777",
    "notaryWallet": "0x70997970c51812dc3a010c7d01b50e0d17dc79c8",
    "documentHash": "a1b2c3d4e5f6...",
    "transactionHash": "0x4f8a12...",
    "blockNumber": 12,
    "contractAddress": "0x5FbDB2315678afecb367f032d93F642f64180aa3",
    "chainId": 31337,
    "onChainTimestamp": 1728472500,
    "rejectionReason": null,
    "failureReason": null,
    "status": "CONFIRMED",
    "createdAt": "2026-10-08T10:05:00.000Z",
    "updatedAt": "2026-10-08T10:06:00.000Z",
    "document": {
      "id": "67039a8c1719b2241cfb5678",
      "originalName": "contract.pdf",
      "sha256Hash": "a1b2c3d4e5f6...",
      "createdAt": "2026-10-08T10:00:00.000Z"
    },
    "owner": {
      "name": "Alice Doe"
    }
  }
}
```
- **Error Responses**:
  - `401 Unauthorized` (`UNAUTHORIZED`): Missing or invalid token.
  - `404 Not Found` (`NOT_FOUND`): Record does not exist or caller is unauthorized (existence not leaked).

#### `POST /api/notarization/:id/reject`
- **Auth**: Bearer JWT (Role: `NOTARY`)
- **Status**: `IMPLEMENTED`
- **Purpose**: Reject a notarization request with a mandatory reason. Transitions Notarization → `REJECTED` and Document → `REJECTED` atomically.
- **Request Body**:
```json
{
  "reason": "Document scan is blurry and signature is illegible"
}
```
- **Validations**:
  - `reason` is required; missing or whitespace-only strings return `400 Bad Request` (`REASON_REQUIRED`).
  - Allowed only from `REQUESTED` or `APPROVED` status; any other status returns `409 Conflict` (`INVALID_STATE`).
- **Success (200)**:
```json
{
  "success": true,
  "notarization": {
    "id": "67039a8c1719b2241cfb9999",
    "status": "REJECTED",
    "rejectionReason": "Document scan is blurry and signature is illegible"
  }
}
```
- **Error Responses**:
  - `400 Bad Request` (`REASON_REQUIRED`): Reason is empty or missing.
  - `403 Forbidden` (`FORBIDDEN`): Caller is not a notary.
  - `403 Forbidden` (`SELF_NOTARIZATION_NOT_ALLOWED`): A notary cannot approve or reject their own document.
  - `404 Not Found` (`NOT_FOUND`): Notarization record not found.
  - `409 Conflict` (`INVALID_STATE`): Notarization is not in `REQUESTED` or `APPROVED` status.

#### `POST /api/notarization/:id/approve`
- **Auth**: Bearer JWT (Role: `NOTARY`)
- **Status**: `IMPLEMENTED`
- **Purpose**: Verify all preconditions, transition Notarization → `APPROVED` atomically, and return the exact smart contract method and arguments for the notary's browser wallet to execute.
- **Allowed States**: `REQUESTED`, `APPROVED` (retry), or `FAILED`. Any other status returns `409 Conflict` (`INVALID_STATE`).
- **Preconditions Checked**:
  0. If notarization fee is enabled, the request must have status `PAID` (`402 Payment Required` / `PAYMENT_REQUIRED`). If fee is disabled, behaviour is unchanged.
  1. Notary cannot approve their own document (`403 Forbidden` / `SELF_NOTARIZATION_NOT_ALLOWED`).
  2. Notary must have a linked wallet (`400 Bad Request` / `WALLET_NOT_LINKED`).
  3. Notary wallet must be authorized on-chain via smart contract `isNotary(address)` (`403 Forbidden` / `NOTARY_NOT_AUTHORIZED_ON_CHAIN`).
  4. Document owner must have a linked wallet (`400 Bad Request` / `OWNER_WALLET_REQUIRED`).
  5. Document hash must not already exist on-chain via smart contract `exists(bytes32)` (`409 Conflict` / `ALREADY_NOTARIZED`).
- **Success (200)**:
```json
{
  "success": true,
  "contractAddress": "0x5FbDB2315678afecb367f032d93F642f64180aa3",
  "chainId": 31337,
  "abi": [
    "function isNotary(address notary) external view returns (bool)",
    "function getDocument(bytes32 documentHash) external view returns (bytes32, string, address, address, uint256)",
    "function verify(bytes32 documentHash) external view returns (address owner_, address notary_, uint256 timestamp_, string ipfsCid_)",
    "function exists(bytes32 documentHash) external view returns (bool)",
    "function getDocumentsByOwner(address owner) external view returns (bytes32[])",
    "event DocumentNotarized(bytes32 indexed documentHash, string ipfsCid, address indexed owner, address indexed notary, uint256 timestamp)",
    "event NotaryAdded(address indexed notary, address indexed addedBy)",
    "event NotaryRemoved(address indexed notary, address indexed removedBy)"
  ],
  "method": "notarize",
  "args": [
    "0xa1b2c3d4e5f67890123456789abcdef0123456789abcdef0123456789abcdef0",
    "",
    "0x70997970C51812dc3A010C7d01b50e0d17dc79C8"
  ],
  "notarization": {
    "id": "67039a8c1719b2241cfb9999",
    "status": "APPROVED",
    "notaryWallet": "0x3c44cdddb6a900fa2b585dd299e03d12fa4293bc"
  }
}
```
- **Error Responses**:
  - `400 Bad Request` (`WALLET_NOT_LINKED`): Notary has no linked wallet.
  - `400 Bad Request` (`OWNER_WALLET_REQUIRED`): Document owner has no linked wallet.
  - `402 Payment Required` (`PAYMENT_REQUIRED`): Notarization fee is enabled and request has not been paid.
  - `403 Forbidden` (`FORBIDDEN`): Caller is not a notary.
  - `403 Forbidden` (`SELF_NOTARIZATION_NOT_ALLOWED`): A notary cannot approve or reject their own document.
  - `403 Forbidden` (`NOTARY_NOT_AUTHORIZED_ON_CHAIN`): Notary wallet not authorized on smart contract.
  - `404 Not Found` (`NOT_FOUND`): Notarization or document not found.
  - `409 Conflict` (`ALREADY_NOTARIZED`): Document hash is already notarized on-chain.
  - `409 Conflict` (`INVALID_STATE`): Request is not in `REQUESTED`, `APPROVED`, or `FAILED` status.

#### `POST /api/notarization/:id/confirm`
- **Auth**: Bearer JWT (Role: `NOTARY` who approved / owns the request)
- **Status**: `IMPLEMENTED`
- **Purpose**: Verify the submitted transaction receipt on-chain using the read-only JSON-RPC provider. On success, transitions Notarization → `CONFIRMED` and Document → `NOTARIZED`.
- **Request Body**:
```json
{
  "transactionHash": "0x4f8a123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"
}
```
- **Verification Rules**:
  - Hash format validated (`0x` + 64 hex characters).
  - Transaction not yet mined → returns `202 Accepted` (`{ "status": "TX_PENDING", "code": "TX_PENDING" }`).
  - Transaction reverted on-chain → sets Notarization `FAILED` with `failureReason: "Transaction reverted on-chain"`, returns `200`.
  - Once mined, ALL of the following must hold:
    1. Receipt status is success (`1`).
    2. `receipt.to` matches the configured contract address.
    3. `network.chainId` matches the configured `CHAIN_ID`.
    4. `tx.from` matches the approving notary's linked wallet.
    5. The `DocumentNotarized` event decoded with the ABI matches this document's hash and the notary's address.
    6. The `transactionHash` is not used by any other confirmed notarization.
  - Any mismatch returns `422 Unprocessable Entity` (`VERIFICATION_FAILED`) with the specific mismatch reason; status remains unchanged.
  - Idempotent: Confirming an already `CONFIRMED` request with the same transaction hash returns `200`.
- **Success (200)**:
```json
{
  "success": true,
  "notarization": {
    "id": "67039a8c1719b2241cfb9999",
    "documentId": "67039a8c1719b2241cfb5678",
    "status": "CONFIRMED",
    "transactionHash": "0x4f8a123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
    "blockNumber": 14,
    "contractAddress": "0x5FbDB2315678afecb367f032d93F642f64180aa3",
    "chainId": 31337,
    "onChainTimestamp": 1728472500,
    "failureReason": null
  }
}
```
- **Pending (202)**:
```json
{
  "success": true,
  "status": "TX_PENDING",
  "code": "TX_PENDING",
  "message": "Transaction has not been mined yet. Try again shortly."
}
```
- **Error Responses**:
  - `400 Bad Request` (`VALIDATION_ERROR`): Invalid transaction hash format.
  - `403 Forbidden` (`FORBIDDEN`): Caller is not the notary assigned to this request.
  - `404 Not Found` (`NOT_FOUND`): Notarization record not found.
  - `409 Conflict` (`INVALID_STATE`): Request is not in `APPROVED` or `FAILED` status, or already confirmed with a different hash.
  - `422 Unprocessable Entity` (`VERIFICATION_FAILED`): Receipt verification failed on-chain or duplicate transaction. The `error.message` returns one of the following specific reason strings:
    - `TX_NOT_FOUND`: Transaction hash not found on chain.
    - `WRONG_CONTRACT`: Transaction recipient address does not match the configured contract address.
    - `WRONG_SIGNER`: Transaction sender address does not match the approving notary's linked wallet.
    - `WRONG_CHAIN`: Transaction was submitted on a different network chain ID than configured.
    - `EVENT_NOT_FOUND`: `DocumentNotarized` event log is missing from the transaction receipt.
    - `WRONG_HASH`: Event document hash parameter does not match the document's SHA-256 hash.
    - `WRONG_EVENT_NOTARY`: Event notary address parameter does not match the approving notary's wallet.
    - `Transaction hash is already used by another confirmed notarization`: Transaction hash has already been used by another confirmed notarization.

#### `POST /api/notarization/:id/payment`
- **Auth**: Bearer JWT (Role: `USER` who requested the notarization; others receive `404 Not Found`)
- **Status**: `IMPLEMENTED`
- **Purpose**: Verify and record fee payment in test ETH for a requested notarization. The user sends a plain transfer from their linked wallet to the configured `FEE_RECIPIENT_ADDRESS`. The backend verifies the transaction on-chain via its read-only provider.
- **Terminology / Framing**: This is test ETH on the local chain, not real money.
- **Refund Limitation**: A fee for a rejected request is marked with `refundDue: true`. The refund itself is manual on the test chain (documented system limitation).
- **Request Body**:
```json
{
  "transactionHash": "0x456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123"
}
```
- **Success (200)**:
```json
{
  "success": true,
  "payment": {
    "status": "PAID",
    "amountWei": "1000000000000000",
    "transactionHash": "0x456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123",
    "payer": "0x70997970c51812dc3a010c7d01b50e0d17dc79c8",
    "recipient": "0x3c44cdddb6a900fa2b585dd299e03d12fa4293bc",
    "blockNumber": 142,
    "paidAt": "2026-10-20T12:00:00.000Z",
    "refundDue": false
  }
}
```
- **Pending (202)**:
```json
{
  "success": true,
  "status": "TX_PENDING",
  "code": "TX_PENDING",
  "message": "Transaction has not been mined yet. Try again shortly."
}
```
- **Idempotency**: Submitting the same transaction hash again for an already `PAID` notarization returns `200 OK` with the existing payment record. Submitting a different transaction hash returns `409 Conflict` (`ALREADY_PAID`).
- **Error Responses**:
  - `400 Bad Request` (`VALIDATION_ERROR`): Invalid transaction hash format.
  - `400 Bad Request` (`WALLET_NOT_LINKED`): User account does not have a linked wallet address.
  - `404 Not Found` (`NOT_FOUND`): Notarization record does not exist or caller is not the owner (prevents information leakage).
  - `409 Conflict` (`FEE_NOT_ENABLED`): Fee feature is disabled (`NOTARIZATION_FEE_ETH=0`).
  - `409 Conflict` (`INVALID_STATE`): Notarization is not in `REQUESTED` status.
  - `409 Conflict` (`ALREADY_PAID`): Notarization is already paid with a different transaction hash.
  - `409 Conflict` (`PAYMENT_ALREADY_USED`): Transaction hash has already been used by another notarization.
  - `422 Unprocessable Entity` (`PAYMENT_INVALID`): Transaction failed validation with a specific reason in `error.details.reason`:
    - `TX_NOT_FOUND`: Transaction hash not found on chain.
    - `TX_REVERTED`: Transaction reverted on-chain.
    - `WRONG_CHAIN`: Transaction chainId does not match configured chain.
    - `WRONG_RECIPIENT`: `tx.to` does not match `FEE_RECIPIENT_ADDRESS`.
    - `WRONG_PAYER`: `tx.from` does not match the requesting user's linked wallet.
    - `AMOUNT_TOO_LOW`: `tx.value` is less than required fee.
    - `NOT_A_PLAIN_TRANSFER`: `tx.data` is not empty (plain ETH transfer required).

#### `GET /api/config/fees`
- **Auth**: None (Public)
- **Status**: `IMPLEMENTED`
- **Purpose**: Returns the public fee configuration so the frontend client knows whether fee payment is required before approval, the amount in ETH/Wei, and the recipient address.
- **Success (200 - Fee Enabled)**:
```json
{
  "success": true,
  "enabled": true,
  "amountEth": "0.001",
  "amountWei": "1000000000000000",
  "recipient": "0x3c44cdddb6a900fa2b585dd299e03d12fa4293bc",
  "chainId": 31337,
  "symbol": "ETH"
}
```
- **Success (200 - Fee Disabled)**:
```json
{
  "success": true,
  "enabled": false
}
```

---

### 5. Verification & Blockchain

#### `GET /api/blockchain/contract`
- **Auth**: Bearer JWT (`ADMIN` only; USER and NOTARY get `403 FORBIDDEN`, unauthenticated callers get `401 UNAUTHORIZED`)
- **Status**: `IMPLEMENTED`
- **Purpose**: Returns the deployed smart contract address, network chainId, and full ABI (including administrative write functions such as `addNotary` and `removeNotary`). Used by the admin frontend to construct on-chain admin transactions via the user's connected wallet (e.g., MetaMask).
- **Security**: The backend **never holds a private key or signer**. This endpoint is strictly read-only and returns contract metadata.
- **Success (200)**:
```json
{
  "success": true,
  "contractAddress": "0x5FbDB2315678afecb367f032d93F642f64180aa3",
  "chainId": 31337,
  "abi": [
    "function getDocument(bytes32 documentHash) external view returns (bytes32, string, address, address, uint256)",
    "function exists(bytes32 documentHash) external view returns (bool)",
    "function isNotary(address notary) external view returns (bool)",
    "function notarize(bytes32 documentHash, string ipfsCid) external",
    "function addNotary(address notary) external",
    "function removeNotary(address notary) external"
  ]
}
```
- **Error Responses**:
  - `401 Unauthorized` (`UNAUTHORIZED`): Missing or invalid JWT bearer token.
  - `403 Forbidden` (`FORBIDDEN`): User does not have `ADMIN` role.
  - `503 Service Unavailable` (`CONTRACT_NOT_DEPLOYED`): Smart contract deployment JSON file is missing or invalid.
  - `503 Service Unavailable` (`CHAIN_UNREACHABLE`): RPC blockchain node is not responding or unreachable.

#### `GET /api/blockchain/:documentId`
- **Auth**: Bearer JWT (`owner`, `NOTARY`, or `ADMIN`; others `404 NOT_FOUND` so existence is not leaked)
- **Status**: `IMPLEMENTED`
- **Purpose**: Retrieve stored database notarization record plus live on-chain smart contract data queried via the read-only JSON-RPC provider.
- **Success (200)**:
```json
{
  "success": true,
  "document": {
    "id": "67039a8c1719b2241cfb5678",
    "sha256Hash": "a1b2c3d4e5f6...",
    "status": "NOTARIZED",
    "ipfsCid": null
  },
  "stored": {
    "id": "67039a8c1719b2241cfb9999",
    "documentId": "67039a8c1719b2241cfb5678",
    "documentHash": "a1b2c3d4e5f6...",
    "status": "CONFIRMED",
    "transactionHash": "0x4f8a12...",
    "blockNumber": 14,
    "notaryWallet": "0x70997970c51812dc3a010c7d01b50e0d17dc79c8",
    "contractAddress": "0x5FbDB2315678afecb367f032d93F642f64180aa3",
    "chainId": 31337,
    "timestamp": 1728472500,
    "rejectionReason": null,
    "failureReason": null
  },
  "onChainRecord": {
    "exists": true,
    "documentHash": "0xa1b2c3d4e5f6...",
    "ipfsCid": "",
    "owner": "0x3c44cdddb6a900fa2b585dd299e03d12fa4293bc",
    "notary": "0x70997970c51812dc3a010c7d01b50e0d17dc79c8",
    "timestamp": 1728472500
  }
}
```
> Note: If the document has not yet been notarized on-chain or the blockchain node is unreachable, `onChainRecord` is `null`. The on-chain `timestamp` indicates that the hash was recorded no later than this time.
- **Error Responses**:
  - `401 Unauthorized` (`UNAUTHORIZED`): Missing or invalid token.
  - `404 Not Found` (`NOT_FOUND`): Document does not exist or caller is unauthorized.

#### `POST /api/verify`
- **Auth**: None (Public endpoint; rate-limited per IP)
- **Status**: `IMPLEMENTED`
- **Content-Type**: `multipart/form-data`
- **Rate Limit**: Default 60 requests/minute per IP (`VERIFY_RATE_LIMIT_PER_MIN`), returns HTTP 429 `RATE_LIMITED` when exceeded.
- **Request Parameters**:
  - `file`: PDF file to verify (binary, required in multipart field `file`).
- **Processing Rules**:
  - Validates file presence, MIME type (`application/pdf`), and `%PDF-` binary magic bytes.
  - Enforces size limit (`MAX_FILE_SIZE_MB`, default 10 MB).
  - Computes SHA-256 hash in memory. **The file is never stored to disk or database.**
  - Looks up the hash on-chain via the read-only JSON-RPC provider calling `DocumentNotary.getRecord(bytes32)`.
  - Authoritative source is on-chain data: `ownerWallet`, `notaryWallet`, and on-chain `timestamp`.
  - The on-chain `timestamp` indicates that the hash was **recorded no later than this time**.
  - If found on-chain, queries database for extra metadata (`transactionHash`, `blockNumber`, and document metadata: `id`, `originalName`). If database record is missing, returns on-chain record without MongoDB extras.
  - Privacy guarantee: Owner name, email, or any private user details are **never returned**.
- **Success - Record Found (200)**:
```json
{
  "success": true,
  "status": "VERIFIED",
  "hash": "a1b2c3d4e5f67890123456789abcdef0123456789abcdef0123456789abcdef0",
  "record": {
    "ownerWallet": "0x3c44cdddb6a900fa2b585dd299e03d12fa4293bc",
    "notaryWallet": "0x70997970c51812dc3a010c7d01b50e0d17dc79c8",
    "timestamp": 1728472500,
    "contractAddress": "0x5FbDB2315678afecb367f032d93F642f64180aa3",
    "transactionHash": "0x4f8a123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
    "blockNumber": 14
  },
  "document": {
    "id": "67039a8c1719b2241cfb5678",
    "originalName": "contract.pdf"
  }
}
```
- **Success - Record Not Found (200)**:
```json
{
  "success": true,
  "status": "NOT_VERIFIED",
  "hash": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
  "message": "No notarization record matches this file's hash."
}
```
> Note: `NOT_VERIFIED` means the file differs from every notarized record (e.g. modified after notarization, or never notarized).
- **Error Responses**:
  - `400 Bad Request` (`INVALID_FILE`): Missing file or file does not have `%PDF-` header / `application/pdf` MIME type.
  - `400 Bad Request` (`FILE_TOO_LARGE`): File exceeds configured `MAX_FILE_SIZE_MB`.
  - `429 Too Many Requests` (`RATE_LIMITED`): Exceeded per-minute rate limit.
  - `503 Service Unavailable` (`CHAIN_UNREACHABLE`): Blockchain RPC provider unreachable.
  - `503 Service Unavailable` (`CONTRACT_NOT_DEPLOYED`): DocumentNotary contract not deployed at configured address.

#### `GET /api/verify/hash/:sha256`
- **Auth**: None (Public endpoint; rate-limited per IP)
- **Status**: `IMPLEMENTED`
- **Rate Limit**: Default 60 requests/minute per IP (`VERIFY_RATE_LIMIT_PER_MIN`), returns HTTP 429 `RATE_LIMITED` when exceeded.
- **Request Parameters**:
  - `sha256` (URL path parameter): 64-character hexadecimal SHA-256 hash string (case-insensitive, optional leading `0x` tolerated).
- **Processing Rules**:
  - Validates `sha256` is a valid 64-character hex string.
  - Looks up hash on-chain directly via `DocumentNotary.getRecord(bytes32)`.
  - Authoritative source is on-chain data: `ownerWallet`, `notaryWallet`, and on-chain `timestamp`.
  - The on-chain `timestamp` indicates that the hash was **recorded no later than this time**.
  - If found on-chain, queries database for extra metadata (`transactionHash`, `blockNumber`, and document metadata: `id`, `originalName`). If database record is missing, returns on-chain record without MongoDB extras.
  - Privacy guarantee: Owner name, email, or any private user details are **never returned**.
- **Success - Record Found (200)**:
```json
{
  "success": true,
  "status": "VERIFIED",
  "hash": "a1b2c3d4e5f67890123456789abcdef0123456789abcdef0123456789abcdef0",
  "record": {
    "ownerWallet": "0x3c44cdddb6a900fa2b585dd299e03d12fa4293bc",
    "notaryWallet": "0x70997970c51812dc3a010c7d01b50e0d17dc79c8",
    "timestamp": 1728472500,
    "contractAddress": "0x5FbDB2315678afecb367f032d93F642f64180aa3",
    "transactionHash": "0x4f8a123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
    "blockNumber": 14
  },
  "document": {
    "id": "67039a8c1719b2241cfb5678",
    "originalName": "contract.pdf"
  }
}
```
- **Success - Record Not Found (200)**:
```json
{
  "success": true,
  "status": "NOT_VERIFIED",
  "hash": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
  "message": "No notarization record matches this hash."
}
```
- **Error Responses**:
  - `400 Bad Request` (`INVALID_HASH`): Invalid SHA-256 hash parameter.
  - `429 Too Many Requests` (`RATE_LIMITED`): Exceeded per-minute rate limit.
  - `503 Service Unavailable` (`CHAIN_UNREACHABLE`): Blockchain RPC provider unreachable.
  - `503 Service Unavailable` (`CONTRACT_NOT_DEPLOYED`): DocumentNotary contract not deployed at configured address.

#### `GET /api/verify/key/:key`
- **Auth**: None (Public endpoint; rate-limited per IP)
- **Status**: `IMPLEMENTED`
- **Rate Limit**: Default 60 requests/minute per IP (`VERIFY_RATE_LIMIT_PER_MIN`), returns HTTP 429 `RATE_LIMITED` when exceeded.
- **Purpose**: A key lookup shows that a record exists; uploading the file proves the file matches it.
- **Key Derivation & Invariants**:
  - The key is a lookup code derived from on-chain data, not stored in the contract.
  - Computed on confirmation as `"GH-"` + the first 16 uppercase hex characters of `keccak256(abi.encodePacked(documentHash bytes32, transactionHash bytes32))`.
  - Stored in MongoDB as the raw 16 characters with a unique sparse index.
  - Display format: `GH-XXXX-XXXX-XXXX-XXXX`.
- **Request Parameters**:
  - `key` (URL path parameter): 16-character hexadecimal lookup code. The server automatically normalizes the input by stripping dashes (`-`) and spaces (` `), removing any optional `GH` prefix, and converting to uppercase.
- **Processing Rules**:
  - Normalizes key (strips dashes and spaces, converts to uppercase).
  - Validates key format; malformed key gives `400 Bad Request` (`INVALID_KEY`).
  - Queries MongoDB for a `CONFIRMED` notarization record matching the raw 16-character key.
  - If no `CONFIRMED` record exists, returns `{ "success": true, "status": "NOT_FOUND", "message": "No notarization record matches this key." }`.
  - If a `CONFIRMED` record exists, the server re-reads the blockchain via `DocumentNotary.getRecord(documentHash)`.
  - **Fail-safe Rule**: If the blockchain cannot be read (RPC provider unreachable or contract missing), the endpoint returns `503 Service Unavailable` (`CHAIN_UNREACHABLE` or `CONTRACT_NOT_DEPLOYED`). It **never** answers `NOT_FOUND` on chain failure.
  - If the on-chain record exists, returns `{ "status": "FOUND", "key": "GH-XXXX-XXXX-XXXX-XXXX", "record": { "notaryWallet", "timestamp", "transactionHash", "blockNumber", "contractAddress" } }`.
  - **Privacy Guarantee**: Strictly **no owner data** (`ownerWallet`, `ownerName`, `email`) and **no file name** (`fileName`, `originalName`) are ever returned.
- **Success - Record Found (200)**:
```json
{
  "success": true,
  "status": "FOUND",
  "key": "GH-DB19-36EF-963F-E929",
  "record": {
    "notaryWallet": "0x70997970c51812dc3a010c7d01b50e0d17dc79c8",
    "timestamp": 1728472500,
    "transactionHash": "0x4f8a123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
    "blockNumber": 14,
    "contractAddress": "0x5FbDB2315678afecb367f032d93F642f64180aa3"
  }
}
```
- **Success - Record Not Found (200)**:
```json
{
  "success": true,
  "status": "NOT_FOUND",
  "message": "No notarization record matches this key."
}
```
- **Error Responses**:
  - `400 Bad Request` (`INVALID_KEY`): Malformed key format (not a 16-hex-character code).
  - `429 Too Many Requests` (`RATE_LIMITED`): Exceeded per-minute rate limit.
  - `503 Service Unavailable` (`CHAIN_UNREACHABLE`): Blockchain RPC provider unreachable. Never returns `NOT_FOUND` when chain cannot be read.
  - `503 Service Unavailable` (`CONTRACT_NOT_DEPLOYED`): DocumentNotary contract missing.

---

### 6. Admin Management

All endpoints under `/api/admin` require valid JWT authentication with the `ADMIN` role (`requireAuth`, `requireRole('ADMIN')`).

> **Security Invariants**:
> - Password hashes, salt values, and wallet nonces are **never exposed** in any response.
> - The backend **never holds a private key**. Changing a user's role to `NOTARY` in the database does **not** authorize them on-chain; on-chain notary authorization must be performed by the contract owner via MetaMask / Hardhat.
> - An administrator cannot change their own role or deactivate their own account (`409 CANNOT_MODIFY_SELF`).
> - Account deactivation immediately invalidates the user's sessions on subsequent requests.

#### `GET /api/admin/users`
- **Auth**: Bearer JWT (`ADMIN`)
- **Status**: `IMPLEMENTED`
- **Purpose**: List system users with optional role filtering, search query, and pagination limit.
- **Query Parameters**:
  - `role` (optional): Filter by role (`USER`, `NOTARY`, or `ADMIN`).
  - `q` (optional): Case-insensitive text search across `name` and `email`.
  - `limit` (optional): Maximum records returned (default `50`, maximum `100`).
- **Success (200)**:
```json
{
  "success": true,
  "users": [
    {
      "id": "67039a8c1719b2241cfb1234",
      "name": "Alice User",
      "email": "alice@example.com",
      "role": "USER",
      "walletAddress": "0x3c44cdddb6a900fa2b585dd299e03d12fa4293bc",
      "isActive": true,
      "authProviders": ["PASSWORD"],
      "googleLinked": false,
      "createdAt": "2026-10-07T10:15:30.000Z",
      "updatedAt": "2026-10-07T10:15:30.000Z"
    }
  ],
  "total": 1
}
```
- **Error Responses**:
  - `401 Unauthorized` (`UNAUTHORIZED`): Missing or invalid token.
  - `403 Forbidden` (`FORBIDDEN`): Caller does not have `ADMIN` role.

#### `PATCH /api/admin/users/:id/role`
- **Auth**: Bearer JWT (`ADMIN`)
- **Status**: `IMPLEMENTED`
- **Purpose**: Update a user's role in the database.
- **Request Body**:
```json
{
  "role": "NOTARY"
}
```
- **Validation Rules**:
  - `role` must be one of `USER`, `NOTARY`, or `ADMIN`.
  - An administrator cannot modify their own role.
- **Success (200)**:
```json
{
  "success": true,
  "user": {
    "id": "67039a8c1719b2241cfb1234",
    "name": "Bob Smith",
    "email": "bob@example.com",
    "role": "NOTARY",
    "walletAddress": null,
    "isActive": true,
    "authProviders": ["PASSWORD"],
    "googleLinked": false,
    "createdAt": "2026-10-07T10:15:30.000Z",
    "updatedAt": "2026-10-07T11:00:00.000Z"
  }
}
```
- **Error Responses**:
  - `400 Bad Request` (`VALIDATION_ERROR`): Invalid role supplied.
  - `401 Unauthorized` (`UNAUTHORIZED`): Missing or invalid token.
  - `403 Forbidden` (`FORBIDDEN`): Caller does not have `ADMIN` role.
  - `404 Not Found` (`NOT_FOUND`): User ID not found.
  - `409 Conflict` (`CANNOT_MODIFY_SELF`): Administrator attempted to modify their own role.

#### `PATCH /api/admin/users/:id/status`
- **Auth**: Bearer JWT (`ADMIN`)
- **Status**: `IMPLEMENTED`
- **Purpose**: Enable or disable a user account.
- **Request Body**:
```json
{
  "isActive": false
}
```
- **Validation Rules**:
  - `isActive` must be a boolean.
  - An administrator cannot disable their own account.
  - Disabling immediately blocks subsequent authenticated requests by the user (`requireAuth` rejects with `403 ACCOUNT_DISABLED`).
- **Success (200)**:
```json
{
  "success": true,
  "user": {
    "id": "67039a8c1719b2241cfb1234",
    "name": "Bob Smith",
    "email": "bob@example.com",
    "role": "NOTARY",
    "walletAddress": null,
    "isActive": false,
    "authProviders": ["PASSWORD"],
    "googleLinked": false,
    "createdAt": "2026-10-07T10:15:30.000Z",
    "updatedAt": "2026-10-07T11:05:00.000Z"
  }
}
```
- **Error Responses**:
  - `400 Bad Request` (`VALIDATION_ERROR`): `isActive` is not a boolean.
  - `401 Unauthorized` (`UNAUTHORIZED`): Missing or invalid token.
  - `403 Forbidden` (`FORBIDDEN`): Caller does not have `ADMIN` role.
  - `404 Not Found` (`NOT_FOUND`): User ID not found.
  - `409 Conflict` (`CANNOT_MODIFY_SELF`): Administrator attempted to modify their own active status.

#### `GET /api/admin/notaries`
- **Auth**: Bearer JWT (`ADMIN`)
- **Status**: `IMPLEMENTED`
- **Purpose**: List all users with role `NOTARY` along with their live on-chain authorization status checked via read-only provider.
- **Success (200)**:
```json
{
  "success": true,
  "notaries": [
    {
      "id": "67039a8c1719b2241cfb5555",
      "name": "Authorized Notary",
      "email": "notary@example.com",
      "role": "NOTARY",
      "walletAddress": "0x70997970c51812dc3a010c7d01b50e0d17dc79c8",
      "isActive": true,
      "createdAt": "2026-10-07T10:15:30.000Z",
      "updatedAt": "2026-10-07T10:15:30.000Z",
      "linkedWallet": "0x70997970c51812dc3a010c7d01b50e0d17dc79c8",
      "onChainAuthorized": true
    }
  ],
  "chainAvailable": true
}
```
> Note: If the blockchain RPC provider is unreachable, returns `chainAvailable: false` with `onChainAuthorized: null` for each notary instead of throwing an error.
- **Error Responses**:
  - `401 Unauthorized` (`UNAUTHORIZED`): Missing or invalid token.
  - `403 Forbidden` (`FORBIDDEN`): Caller does not have `ADMIN` role.

#### `GET /api/admin/activity`
- **Auth**: Bearer JWT (`ADMIN`)
- **Status**: `IMPLEMENTED`
- **Purpose**: Retrieve the latest 50 notarization activities across the system, ordered newest first.
- **Privacy Rule**: Requester email, password hashes, and sensitive user details are strictly omitted; only requester name and document original filename are displayed.
- **Success (200)**:
```json
{
  "success": true,
  "activity": [
    {
      "id": "67039a8c1719b2241cfb9999",
      "status": "CONFIRMED",
      "documentName": "Partnership_Agreement.pdf",
      "requesterName": "Alice Client",
      "notaryWallet": "0x70997970c51812dc3a010c7d01b50e0d17dc79c8",
      "transactionHash": "0x4f8a123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
      "blockNumber": 14,
      "createdAt": "2026-10-07T10:15:30.000Z",
      "updatedAt": "2026-10-07T10:20:00.000Z"
    }
  ]
}
```
- **Error Responses**:
  - `401 Unauthorized` (`UNAUTHORIZED`): Missing or invalid token.
  - `403 Forbidden` (`FORBIDDEN`): Caller does not have `ADMIN` role.

#### `GET /api/admin/stats`
- **Auth**: Bearer JWT (`ADMIN`)
- **Status**: `IMPLEMENTED`
- **Purpose**: Retrieve aggregate system statistics including user counts by role, notaries with wallets, and document/notarization counts grouped by status.
- **Success (200)**:
```json
{
  "success": true,
  "users": {
    "total": 12,
    "byRole": {
      "USER": 9,
      "NOTARY": 2,
      "ADMIN": 1
    }
  },
  "notaries": {
    "total": 2,
    "withWallet": 1
  },
  "documents": {
    "total": 8,
    "byStatus": {
      "PENDING": 2,
      "APPROVED": 1,
      "REJECTED": 1,
      "NOTARIZED": 4
    }
  },
  "notarizations": {
    "total": 8,
    "byStatus": {
      "REQUESTED": 1,
      "APPROVED": 1,
      "REJECTED": 1,
      "CONFIRMED": 4,
      "FAILED": 1
    }
  }
}
```
- **Error Responses**:
  - `401 Unauthorized` (`UNAUTHORIZED`): Missing or invalid token.
  - `403 Forbidden` (`FORBIDDEN`): Caller does not have `ADMIN` role.

