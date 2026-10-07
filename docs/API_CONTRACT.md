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

## 📋 Endpoints Overview

| Method | Endpoint | Auth | Purpose | Status |
|:---|:---|:---:|:---|:---|
| `GET` | `/api/health` | Public | System uptime & MongoDB connection status | **IMPLEMENTED** |
| `POST` | `/api/auth/register` | Public | Register a new user account (role USER) | **IMPLEMENTED** |
| `POST` | `/api/auth/login` | Public | Authenticate user & return signed JWT | **IMPLEMENTED** |
| `GET` | `/api/auth/me` | JWT | Fetch authenticated user profile | **IMPLEMENTED** |
| `PATCH` | `/api/auth/wallet` | JWT | Associate public Ethereum wallet with user | **IMPLEMENTED** |
| `POST` | `/api/documents/upload` | JWT | Upload document file & generate SHA-256 hash | PLANNED (Day 6) |
| `GET` | `/api/documents` | JWT | List documents belonging to authenticated user | PLANNED (Day 6) |
| `GET` | `/api/documents/:id` | JWT | Get single document metadata | PLANNED (Day 6) |
| `POST` | `/api/notarization/request` | JWT | Request notary attestation for a document | PLANNED (Day 9–10) |
| `GET` | `/api/notarization/pending` | JWT (NOTARY) | List pending notarization requests | PLANNED (Day 9–10) |
| `POST` | `/api/notarization/:id/approve` | JWT (NOTARY) | Approve request and commit to blockchain | PLANNED (Day 9–10) |
| `POST` | `/api/notarization/:id/reject` | JWT (NOTARY) | Reject notarization with reason | PLANNED (Day 9–10) |
| `POST` | `/api/verify` | Public | Verify SHA-256 hash or document against blockchain | PLANNED (Day 11) |
| `GET` | `/api/blockchain/:documentId` | Public | Retrieve raw on-chain notarization receipt | PLANNED (Day 8–10) |

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

#### `PATCH /api/auth/wallet`
- **Auth**: Bearer JWT
- **Request Body**:
```json
{
  "walletAddress": "0x70997970c51812dc3a010c7d01b50e0d17dc79c8"
}
```
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

---

### 3. Documents (PLANNED - Day 6)

#### `POST /api/documents/upload`
- **Auth**: Bearer JWT
- **Status**: `PLANNED - Day 6` (Returns HTTP 501 `NOT_IMPLEMENTED`)

#### `GET /api/documents`
- **Auth**: Bearer JWT
- **Status**: `PLANNED - Day 6` (Returns HTTP 501 `NOT_IMPLEMENTED`)

#### `GET /api/documents/:id`
- **Auth**: Bearer JWT
- **Status**: `PLANNED - Day 6` (Returns HTTP 501 `NOT_IMPLEMENTED`)

---

### 4. Notarization Workflows (PLANNED - Day 9–10)

#### `POST /api/notarization/request`
- **Auth**: Bearer JWT
- **Status**: `PLANNED - Day 9-10` (Returns HTTP 501 `NOT_IMPLEMENTED`)

#### `GET /api/notarization/pending`
- **Auth**: Bearer JWT (Role: `NOTARY` or `ADMIN`)
- **Status**: `PLANNED - Day 9-10` (Returns HTTP 501 `NOT_IMPLEMENTED`)

#### `POST /api/notarization/:id/approve`
- **Auth**: Bearer JWT (Role: `NOTARY`)
- **Status**: `PLANNED - Day 9-10` (Returns HTTP 501 `NOT_IMPLEMENTED`)

#### `POST /api/notarization/:id/reject`
- **Auth**: Bearer JWT (Role: `NOTARY`)
- **Status**: `PLANNED - Day 9-10` (Returns HTTP 501 `NOT_IMPLEMENTED`)

---

### 5. Verification & Blockchain (PLANNED - Day 8–11)

#### `POST /api/verify`
- **Auth**: None
- **Status**: `PLANNED - Day 11` (Returns HTTP 501 `NOT_IMPLEMENTED`)

#### `GET /api/blockchain/:documentId`
- **Auth**: None
- **Status**: `PLANNED - Day 8-10` (Returns HTTP 501 `NOT_IMPLEMENTED`)
