# GoHash — Project Flow

> Wording standard: on-chain timestamps mean **"the hash was recorded no later than this time"**. SHA-256 is a one-way cryptographic digest, not encryption.

---

## 1. User Journeys by Role

### USER Journey

```
Register / Login
      │
      ▼
Link MetaMask wallet (free signed message, POST /api/auth/wallet/nonce → PATCH /api/auth/wallet)
      │
      ▼
Upload PDF (POST /api/documents/upload)
  → Backend computes SHA-256 server-side
  → Document saved with status: PENDING
      │
      ▼
View document list (/documents) and document detail (/documents/:id)
      │
      ▼
Request notarization (POST /api/notarization/request)
  → Notarization record created with status: REQUESTED
  → Document status unchanged (still PENDING)
      │
      ▼
Wait for NOTARY to process the request
      │
      ▼
If APPROVED by notary → Document becomes NOTARIZED
   └─ View certificate (/documents/:id/certificate)
   └─ On-chain details visible in DocumentDetailPage

If REJECTED → Document status: REJECTED; rejection reason shown
```

### NOTARY Journey

```
Login → Link MetaMask wallet (Account #1 from Hardhat)
      │
      ▼
View pending requests (GET /api/notarization/pending)
  → /notary/dashboard shows table of REQUESTED notarizations
      │
      ▼
Open a request (/notary/requests/:id)
  → Read document metadata
  → Stream PDF inline (GET /api/documents/:id/file)
      │
      ├── Reject → POST /api/notarization/:id/reject {reason}
      │            Notarization: REJECTED; Document: REJECTED
      │
      └── Approve → 5-step state machine:
            Step 1  [preparing]      POST /api/notarization/:id/approve
                                     Backend checks: wallet linked, authorized on-chain,
                                     owner has wallet, hash not already registered
                                     Returns: {contractAddress, chainId, abi, method, args}
            Step 2  [awaiting-wallet] MetaMask popup
                                     NOTARY signs notarize(hash, "", ownerWallet)
                                     No ETH transferred; only gas fee
            Step 3  [pending]        Wait for transaction to be mined
                                     (polls every 2 s, up to 30 s for 202 TX_PENDING)
            Step 4  [verifying]      POST /api/notarization/:id/confirm {transactionHash}
                                     Backend verifies receipt (see architecture.md §7)
            Step 5  [confirmed]      Notarization: CONFIRMED; Document: NOTARIZED
```

### ADMIN Journey

```
Login (admin@gohash.io)
      │
      ├── /admin/dashboard
      │     GET /api/admin/stats      → counts: users, documents, notarizations by status
      │     GET /api/admin/activity   → last 50 notarization events
      │
      └── /admin/notaries (user + notary management)
            GET /api/admin/users      → all users with roles
            GET /api/admin/notaries   → notary users + live on-chain authorization status
                                       (reads isNotary(walletAddress) from blockchain)

            ── Role management ──
            PATCH /api/admin/users/:id/role   {role: USER|NOTARY|ADMIN}
              Note: changing role off-chain does NOT affect on-chain authorization.
              A NOTARY role without on-chain authorization cannot approve notarizations.

            PATCH /api/admin/users/:id/status {isActive: true|false}
              Disabling a user immediately invalidates their JWT (403 ACCOUNT_DISABLED).

            ── On-chain authorization (requires MetaMask with Account #0) ──
            Authorize: Admin calls addNotary(walletAddress) via MetaMask
            Revoke:    Admin calls removeNotary(walletAddress) via MetaMask
              Frontend fetches {contractAddress, chainId, abi} from GET /api/blockchain/contract
              No contract address is hardcoded in the frontend.
```

---

## 2. Document Status State Table

| Status | Meaning | Transitions IN | Transitions OUT |
|:-------|:--------|:---------------|:----------------|
| `PENDING` | Uploaded, not yet requested | Upload | → REQUESTED (on request) |
| `REQUESTED`* | Notarization requested | PENDING | → NOTARIZED (on confirm), → REJECTED (on reject) |
| `REJECTED` | Notary rejected the request | REQUESTED | (terminal) |
| `NOTARIZED` | On-chain proof confirmed | REQUESTED | (terminal) |

*When a notarization request is approved by the notary (status APPROVED in the Notarization record), the Document status remains PENDING/REQUESTED until the confirm step succeeds.

Source: `backend/src/services/notarization.service.ts` → `DocumentModel.findByIdAndUpdate`.

---

## 3. Notarization Status State Table

| Status | Meaning | Transitions IN | Transitions OUT |
|:-------|:--------|:---------------|:----------------|
| `REQUESTED` | Request created | (created) | → APPROVED, → REJECTED |
| `APPROVED` | Notary approved; waiting for tx | REQUESTED, FAILED (retry) | → CONFIRMED, → FAILED, → REJECTED |
| `REJECTED` | Notary rejected the request | REQUESTED, APPROVED | (terminal) |
| `CONFIRMED` | Receipt verified; document NOTARIZED | APPROVED | (terminal, idempotent re-confirm) |
| `FAILED` | On-chain tx reverted | APPROVED | → APPROVED (retry allowed) |

Source: `backend/src/services/notarization.service.ts` → `approveNotarization`, `confirmNotarization`, `rejectNotarization`.

**Atomic transitions**: all status updates use `findOneAndUpdate` with the current status in the filter condition to prevent race conditions.

---

## 4. Verification Decision Logic (POST /api/verify)

```
Receive multipart PDF upload
         │
         ▼
Compute SHA-256 (server-side; file not stored)
         │
         ▼
Try: blockchain node reachable?
         │
    NO ──┘──── 503 CHAIN_UNREACHABLE
         │
         ▼
contract.exists(sha256Hash)
         │
    false──── {status: "NOT_VERIFIED", hash: "<computed>"}
         │
       true
         │
         ▼
contract.getDocument(sha256Hash)
         │
         ▼
{
  status: "VERIFIED",
  hash: "<sha256>",
  notaryWallet: "<address>",
  ownerWallet: "<address>",
  onChainTimestamp: <unix>,   // "recorded no later than this time"
  transactionHash: "<0x...>",
  blockNumber: <n>,
  contractAddress: "<0x...>"
}
```

Note: `NOT_VERIFIED` means the hash is not on-chain. This covers both:
- Documents that were never notarized.
- Documents that were tampered with after notarization (hash changed → not found).

The endpoint does **not** look up the MongoDB database; it queries the chain directly, making the result independently verifiable without trusting GoHash's database.

---

## 5. Tamper Demo

```powershell
# Step 1: Get the hash of the original file
Get-FileHash .\original.pdf -Algorithm SHA256

# Step 2: Create a tampered copy (append one null byte)
$content = [System.IO.File]::ReadAllBytes(".\original.pdf")
$tampered = $content + [byte]0x20
[System.IO.File]::WriteAllBytes(".\tampered.pdf", $tampered)

# Step 3: Get the hash of the tampered copy — it will be different
Get-FileHash .\tampered.pdf -Algorithm SHA256
```

- Upload `original.pdf` to `/verify` → **VERIFIED** (hash found on-chain).
- Upload `tampered.pdf` to `/verify` → **NOT VERIFIED** (different hash, not on-chain).

This demonstrates tamper-evidence: even a single added byte produces a completely different SHA-256 digest.
