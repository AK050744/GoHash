# DocumentNotary Contract Interface

Derived exclusively from `blockchain/contracts/DocumentNotary.sol` (Solidity 0.8.24).
All names used in backend code are the exact names from this document.

---

## Deployment Facts

| Property | Value |
|:---|:---|
| Contract name | `DocumentNotary` |
| Solidity version | `^0.8.24` |
| Local chain ID | `31337` (Hardhat localhost) |
| Local RPC | `http://127.0.0.1:8545` |

---

## State Variables (public)

| Name | Type | Notes |
|:---|:---|:---|
| `contractOwner` | `address` | Set in constructor to `msg.sender` (the deployer). Read via `contract.contractOwner()`. |

---

## Struct: NotarizedDocument

Stored in `_documents[documentHash]` (private mapping).

```solidity
struct NotarizedDocument {
    bytes32 documentHash; // SHA-256 hash of the document
    string  ipfsCid;      // IPFS CID where the document is stored off-chain
    address owner;        // Address that owns / submitted the document
    address notary;       // Authorized notary who performed the notarization
    uint256 timestamp;    // Block timestamp at the time of notarization
    bool    exists;       // Existence guard — always true once written
}
```

> **On-Chain Semantics & Wording Standards**:
> - The on-chain `timestamp` signifies that **the hash was recorded no later than this time**. It does not prove authorship or original creation time.
> - Hashing (SHA-256) is a one-way cryptographic digest, **not encryption**.
> - The document file is never stored on-chain or made public.
> - Architecture is one shared `DocumentNotary` contract; no per-user contracts and no NFTs/tokens.
> - Never write "immutable", "cannot be altered", "court-admissible", or "impossible collision".

---

## External Functions

### Owner-only functions (caller must be `contractOwner`)

#### `addNotary(address notary)`

| Property | Detail |
|:---|:---|
| Visibility | `external` |
| Caller | `contractOwner` only |
| Arguments | `notary` — address to authorize |
| Reverts | `NotContractOwner(caller)` if `msg.sender != contractOwner` |
| Reverts | `InvalidAddress()` if `notary == address(0)` |
| Reverts | `NotaryAlreadyAuthorized(notary)` if already authorized |
| Emits | `NotaryAdded(notary, addedBy)` |

#### `removeNotary(address notary)`

| Property | Detail |
|:---|:---|
| Visibility | `external` |
| Caller | `contractOwner` only |
| Arguments | `notary` — address to revoke |
| Reverts | `NotContractOwner(caller)` if `msg.sender != contractOwner` |
| Reverts | `InvalidAddress()` if `notary == address(0)` |
| Reverts | `NotaryNotFound(notary)` if not currently authorized |
| Emits | `NotaryRemoved(notary, removedBy)` |

---

### Notary-only function (caller must be authorized via `_notaries`)

#### `notarize(bytes32 documentHash, string calldata ipfsCid, address owner)`

| Property | Detail |
|:---|:---|
| Visibility | `external` |
| Caller | Any address authorized via `addNotary()` |
| Arguments | `documentHash` — SHA-256 hash of the document as `bytes32` |
| | `ipfsCid` — IPFS content identifier (CIDv0 or CIDv1) string |
| | `owner` — address of the document owner |
| Reverts | `NotAuthorizedNotary(caller)` if `_notaries[msg.sender]` is false |
| Reverts | `InvalidHash()` if `documentHash == bytes32(0)` |
| Reverts | `InvalidAddress()` if `owner == address(0)` |
| Reverts | `DocumentAlreadyNotarized(documentHash)` if `_documents[documentHash].exists` is already true |
| Emits | `DocumentNotarized(documentHash, ipfsCid, owner, notary, timestamp)` |
| Effect | Stores `NotarizedDocument` struct; appends `documentHash` to `_ownerDocuments[owner]` |

---

### View functions (no state change, callable by anyone including read-only providers)

#### `isNotary(address notary) → bool`

| Property | Detail |
|:---|:---|
| Visibility | `external view` |
| Arguments | `notary` — address to query |
| Returns | `true` if the address is currently authorized; `false` otherwise |
| Reverts | Never |

Use this to check on-chain whether a notary wallet is still authorized before approving a notarization request.

#### `getDocument(bytes32 documentHash) → (bytes32 documentHash_, string ipfsCid_, address owner_, address notary_, uint256 timestamp_)`

| Property | Detail |
|:---|:---|
| Visibility | `external view` |
| Arguments | `documentHash` — SHA-256 hash to look up |
| Returns | Five-tuple: echoed hash, IPFS CID, owner address, notary address, Unix timestamp |
| Reverts | `DocumentNotFound(documentHash)` if `!_documents[documentHash].exists` |

#### `verify(bytes32 documentHash) → (address owner_, address notary_, uint256 timestamp_, string ipfsCid_)`

| Property | Detail |
|:---|:---|
| Visibility | `external view` |
| Arguments | `documentHash` — SHA-256 hash to verify |
| Returns | Four-tuple: owner, notary, timestamp, IPFS CID |
| Reverts | `DocumentNotFound(documentHash)` if not notarized |

#### `exists(bytes32 documentHash) → bool`

| Property | Detail |
|:---|:---|
| Visibility | `external view` |
| Arguments | `documentHash` — SHA-256 hash to check |
| Returns | `true` if the document has been notarized; `false` otherwise |
| Reverts | Never |

Use this to detect `ALREADY_NOTARIZED` before calling `notarize()`.

#### `getDocumentsByOwner(address owner) → bytes32[]`

| Property | Detail |
|:---|:---|
| Visibility | `external view` |
| Arguments | `owner` — address to query |
| Returns | Array of all `bytes32` document hashes registered for that owner |
| Reverts | Never |

#### `getMyDocuments() → bytes32[]`

| Property | Detail |
|:---|:---|
| Visibility | `external view` |
| Caller | Any; returns documents for `msg.sender` |
| Returns | Array of document hashes owned by `msg.sender` |
| Reverts | Never |

---

## Events

### `DocumentNotarized`

```solidity
event DocumentNotarized(
    bytes32 indexed documentHash,
    string          ipfsCid,
    address indexed owner,
    address indexed notary,
    uint256         timestamp
);
```

| Argument | Type | Indexed | Description |
|:---|:---|:---:|:---|
| `documentHash` | `bytes32` | YES | SHA-256 hash of the notarized document |
| `ipfsCid` | `string` | NO | IPFS content identifier |
| `owner` | `address` | YES | Document owner address |
| `notary` | `address` | YES | Notary who executed the notarization |
| `timestamp` | `uint256` | NO | `block.timestamp` at the time of notarization |

This is the primary event decoded in `POST /api/notarization/:id/confirm` receipt verification. The backend checks `documentHash` and `notary` match expectations.

### `NotaryAdded`

```solidity
event NotaryAdded(address indexed notary, address indexed addedBy);
```

Emitted by `addNotary()`.

### `NotaryRemoved`

```solidity
event NotaryRemoved(address indexed notary, address indexed removedBy);
```

Emitted by `removeNotary()`.

---

## Custom Errors

| Error | Arguments | Thrown by |
|:---|:---|:---|
| `NotContractOwner(address caller)` | caller | `addNotary`, `removeNotary` |
| `NotAuthorizedNotary(address caller)` | caller | `notarize` |
| `DocumentAlreadyNotarized(bytes32 documentHash)` | documentHash | `notarize` |
| `DocumentNotFound(bytes32 documentHash)` | documentHash | `getDocument`, `verify` |
| `InvalidHash()` | — | `notarize` |
| `InvalidAddress()` | — | `addNotary`, `removeNotary`, `notarize` |
| `NotaryAlreadyAuthorized(address notary)` | notary | `addNotary` |
| `NotaryNotFound(address notary)` | notary | `removeNotary` |

---

## Reading a Notarization Record

```typescript
// 1. Check existence (never reverts)
const onChain: boolean = await contract.exists(bytes32Hash)

// 2. Get full record (reverts with DocumentNotFound if not notarized)
const [documentHash_, ipfsCid_, owner_, notary_, timestamp_] =
  await contract.getDocument(bytes32Hash)

// 3. Alternative: verify() returns (owner, notary, timestamp, ipfsCid)
const [owner_, notary_, timestamp_, ipfsCid_] =
  await contract.verify(bytes32Hash)
```

Converting a 64-char hex SHA-256 string to `bytes32`:

```typescript
// sha256Hash is a 64-char hex string (no 0x prefix)
const bytes32Hash = `0x${sha256Hash}` as `0x${string}`
```

---

## Checking Notary Authorization

```typescript
// Returns true if wallet is currently an authorized notary
const authorized: boolean = await contract.isNotary(walletAddress)
```

---

## What the Frontend Must Call (not the backend)

The `notarize(bytes32 documentHash, string ipfsCid, address owner)` function must be called by the notary's wallet (via MetaMask or equivalent). The backend:

1. Verifies all preconditions (`isNotary`, `exists`).
2. Returns `{ contractAddress, chainId, abi, method, args }` so the frontend can call the contract.
3. Receives the resulting `transactionHash` via `POST /api/notarization/:id/confirm`.
4. Verifies the receipt on-chain (status, address, event, signers) before marking the document `NOTARIZED`.

---

## ABI Subset Used by the Backend (read-only)

```json
[
  "function isNotary(address notary) external view returns (bool)",
  "function getDocument(bytes32 documentHash) external view returns (bytes32, string, address, address, uint256)",
  "function verify(bytes32 documentHash) external view returns (address owner_, address notary_, uint256 timestamp_, string ipfsCid_)",
  "function exists(bytes32 documentHash) external view returns (bool)",
  "function getDocumentsByOwner(address owner) external view returns (bytes32[])",
  "event DocumentNotarized(bytes32 indexed documentHash, string ipfsCid, address indexed owner, address indexed notary, uint256 timestamp)",
  "event NotaryAdded(address indexed notary, address indexed addedBy)",
  "event NotaryRemoved(address indexed notary, address indexed removedBy)"
]
```

The backend never calls `notarize()`, `addNotary()`, or `removeNotary()`. Those require a signer and are called exclusively by wallet clients.
