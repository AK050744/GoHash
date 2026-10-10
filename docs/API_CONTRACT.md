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
| `GET` | `/api/notarization/pending` | JWT (NOTARY) | List pending notarization requests | **IMPLEMENTED** |
| `GET` | `/api/notarization/:id` | JWT | Get single notarization details (owner, NOTARY, ADMIN) | **IMPLEMENTED** |
| `POST` | `/api/notarization/:id/approve` | JWT (NOTARY) | Validate preconditions and prepare on-chain notarize call | **IMPLEMENTED** |
| `POST` | `/api/notarization/:id/reject` | JWT (NOTARY) | Reject notarization with reason | **IMPLEMENTED** |
| `POST` | `/api/notarization/:id/confirm` | JWT (NOTARY) | Verify on-chain transaction receipt & confirm notarization | **IMPLEMENTED** |
| `GET` | `/api/blockchain/:documentId` | JWT | Retrieve stored and on-chain notarization receipt | **IMPLEMENTED** |
| `POST` | `/api/verify` | Public | Verify SHA-256 hash or document against blockchain | PLANNED (Sprint 5A) |

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
  - `404 Not Found` (`NOT_FOUND`): Notarization record not found.
  - `409 Conflict` (`INVALID_STATE`): Notarization is not in `REQUESTED` or `APPROVED` status.

#### `POST /api/notarization/:id/approve`
- **Auth**: Bearer JWT (Role: `NOTARY`)
- **Status**: `IMPLEMENTED`
- **Purpose**: Verify all preconditions, transition Notarization → `APPROVED` atomically, and return the exact smart contract method and arguments for the notary's browser wallet to execute.
- **Allowed States**: `REQUESTED`, `APPROVED` (retry), or `FAILED`. Any other status returns `409 Conflict` (`INVALID_STATE`).
- **Preconditions Checked**:
  1. Notary must have a linked wallet (`400 Bad Request` / `WALLET_NOT_LINKED`).
  2. Notary wallet must be authorized on-chain via smart contract `isNotary(address)` (`403 Forbidden` / `NOTARY_NOT_AUTHORIZED_ON_CHAIN`).
  3. Document owner must have a linked wallet (`400 Bad Request` / `OWNER_WALLET_REQUIRED`).
  4. Document hash must not already exist on-chain via smart contract `exists(bytes32)` (`409 Conflict` / `ALREADY_NOTARIZED`).
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

---

### 5. Verification & Blockchain

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
- **Auth**: None
- **Status**: `PLANNED - Sprint 5A` (Returns HTTP 501 `NOT_IMPLEMENTED`)
