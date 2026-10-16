# GoHash — Viva Q&A

Answers are written for a student to say aloud during a viva. Keep responses concise: 4–6 lines each.

---

## Q1: Why did you use a blockchain instead of a regular database?

A regular database is controlled by one organization, so anyone who owns the server can change or delete records. A blockchain (even a local test one) records data in blocks that are linked by cryptographic hashes. Once a block is finalized, changing it would require re-computing all subsequent blocks, which is detectable. In GoHash, we use the blockchain as an independent proof layer: the document hash is written there by the notary's wallet, and anyone with the hash and the contract address can check it without asking GoHash's server. This makes the proof independently verifiable and tamper-evident — not because it is physically impossible to attack, but because any tampering with the chain would be immediately visible.

---

## Q2: Why do you hash the document instead of storing the document itself?

A document can be megabytes in size; a SHA-256 hash is always exactly 32 bytes. Storing documents on a blockchain would be extremely expensive in gas fees and would make the chain grow rapidly. More importantly, storing documents publicly would be a privacy problem. Instead, we store only the cryptographic fingerprint: if the original document produces the same hash, you know it has not changed. The document content stays off-chain; only the proof goes on-chain.

---

## Q3: Why is the PDF not on-chain?

Three reasons. First, on-chain storage costs gas for every byte, so even a 1 MB PDF would cost a lot. Second, blockchain data is public and permanent, so storing a private document there would be a serious privacy issue. Third, the purpose of the blockchain here is not storage — it is proof. You only need the 32-byte hash to prove the document existed and was attested at a point in time. The PDF lives on the backend server, protected by JWT authentication; only the owner, notary, and admin can access it.

---

## Q4: Is hashing the same as encryption?

No. Encryption is reversible: you can decrypt ciphertext back to plaintext with the right key. Hashing is a one-way function: given the hash, you cannot reconstruct the original document. SHA-256 is designed to be collision-resistant, meaning it should be computationally infeasible to find two different documents with the same hash (though SHA-256 is not collision-proof in the mathematical sense — there is no proof that it is impossible). We never call the hash an "encrypted hash" because that would be technically wrong.

---

## Q5: What does the wallet do? Why is signing free for wallet linking?

A crypto wallet holds a private key that can digitally sign messages and transactions. In GoHash, the wallet has two roles. First, wallet linking: when a user or notary connects their wallet, the backend sends a random challenge message; the wallet signs it with the private key; the backend verifies the signature using the public address. Signing a message costs no gas because it is a local cryptographic operation, not a transaction sent to the network. Second, the notary's wallet signs the actual `notarize()` transaction when approving a document. That transaction does go to the network and costs a small amount of gas (but no ETH is transferred between parties).

---

## Q6: Who is the notary, and what does the notary actually check?

In GoHash, a notary is a user with the NOTARY role whose wallet address has been authorized on-chain by the admin (contract owner). The notary can see the pending requests, open the PDF, and decide to approve or reject. What the notary checks within the system: they read the document and metadata; they confirm it is what the user claims it to be. What the system does NOT check: it does not verify the notary's real-world identity (no Aadhaar or DSC), and it does not verify the document's legal authenticity. The identity verification and document review happen outside the system — the notary role in GoHash is closer to a "witnessed timestamp" than a legally authorized notarial act.

---

## Q7: Is this legally valid? Can the certificate be used in court?

No. GoHash is a technical prototype. The certificate says explicitly: "Technical integrity proof of this document's SHA-256 hash. Not a substitute for legally recognized notarization." A legally recognized notarial act in India requires a licensed notary public operating under the Notaries Act 1952, or an Aadhaar-based eSign service for electronic documents. GoHash demonstrates that a document hash existed and was attested at a point in time, but it does not carry legal weight. We do not claim it is court-admissible.

---

## Q8: How is GoHash different from DigiLocker?

According to public documentation, DigiLocker is a government-operated platform that stores and shares digitally signed documents issued by government agencies (Aadhaar, driving licence, etc.). Documents issued through DigiLocker carry legal standing under the IT Act. GoHash is a prototype that records a SHA-256 hash of any document on a local test blockchain, attested by a designated notary. The differences are: GoHash has a separate notary role (rather than the document issuer themselves), the proof is stored outside the file on a blockchain (rather than as an embedded digital signature), and anyone with the hash can check it independently. Tamper detection and timestamps are not unique to GoHash — DigiLocker also provides them. GoHash does not provide legal weight. An interesting future direction would be combining Aadhaar eSign (for legal weight) with a blockchain anchor (for independent verifiability), but that is not implemented.

---

## Q9: How is GoHash different from ChainFiles-style projects that use NFTs per document?

Some blockchain document projects mint an NFT for each document, use per-user contracts, or make the document owner sign the blockchain transaction. GoHash takes a different design: one shared `DocumentNotary` contract (not one per user), no NFTs or tokens, and the notary (not the document owner) signs the on-chain transaction. This means the owner does not need to pay gas or even own a wallet to have their document notarized — the notary's wallet pays. The innovation in GoHash is not blockchain itself, but the separation of roles (user, notary, admin) and the server-side receipt verification step that ties the on-chain proof back to the off-chain metadata in a trustworthy way.

---

## Q10: What is the innovation in GoHash?

The main technical contribution is the end-to-end integrity chain: the backend computes the hash (so the frontend cannot tamper with it), the notary signs the transaction in their own wallet (so the backend cannot sign on their behalf), and the backend independently verifies the on-chain receipt (checking contract address, event hash, notary signer) before marking the document NOTARIZED. This means no single party — not the user, not the notary, not the GoHash server — can forge a NOTARIZED record without an actual on-chain transaction from an authorized notary wallet. The RBAC model (with on-chain authorization separate from off-chain roles) and the MetaMask-integrated 5-step approval state machine are also non-trivial engineering contributions.

---

## Q11: What does the admin do?

The admin manages users and the notary registry. Off-chain actions (via the GoHash dashboard): view all users, change user roles (USER → NOTARY → ADMIN), enable or disable accounts. On-chain actions (via MetaMask with Account #0): call `addNotary(address)` to authorize a notary wallet on the smart contract, or `removeNotary(address)` to revoke it. The admin wallet is the contract deployer (Hardhat Account #0); only this address can call the owner-only contract functions. Importantly, off-chain role promotion to NOTARY does not automatically grant on-chain authorization — both steps must be done.

---

## Q12: What is a notarize transaction? Is any token or NFT minted?

A notarize transaction is a single call to the `notarize(bytes32 documentHash, string ipfsCid, address owner)` function on the `DocumentNotary` smart contract. It records the document hash, the owner's wallet address, the notary's wallet address, and the block timestamp in the contract's private mapping. No ETH is transferred between parties — only the gas fee is paid by the notary. No token is minted; no NFT is created; no new contract is deployed. The smart contract emits a `DocumentNotarized` event which the backend reads from the transaction receipt to verify the notarization.

---

## Q13: What about privacy? Who can see the document?

The PDF file is stored on the backend server at `backend/uploads/<documentId>.pdf`. It is protected by JWT authentication and is only accessible to the document owner, any notary (to review the request), and an admin. The hash and wallet addresses are public on-chain — anyone with the contract address can read them. The document content is never on-chain and never publicly accessible through GoHash. The filename is stored only in MongoDB (off-chain). This means the on-chain record reveals that a document with a certain hash was attested by a certain notary for a certain owner address, but reveals nothing about the document's content.

---

## Q14: Is this really decentralized?

Honestly, no — not in this prototype. There is one local Hardhat node running on one machine. If that machine goes offline, the blockchain is unreachable. A truly decentralized deployment would use a public blockchain (Ethereum mainnet or a public testnet like Sepolia) where the contract is replicated across thousands of nodes. Deploying to a public network is listed as future work. The architecture, however, is designed for it: the backend uses a standard JSON-RPC provider and the contract is standard EVM Solidity, so pointing `RPC_URL` at a public node and redeploying would be the main change needed.

---

## Q15: What happens when the Hardhat node restarts?

All on-chain data is lost because Hardhat's in-memory node does not persist state across restarts. The MongoDB records (users, documents, notarizations) still say NOTARIZED, but those records would be inconsistent with the (now empty) blockchain. After a restart, you must: (1) redeploy the contract (`npx hardhat run scripts/deploy-local.ts --network localhost`), (2) restart the backend so it reloads `localhost.json`, (3) clear MetaMask activity data for the Hardhat Local network to reset cached nonces. This is a known limitation of using a local test node.

---

## Q16: Is SHA-256 collision-resistant? What if two documents have the same hash?

SHA-256 produces a 256-bit output, giving 2^256 possible hash values. No two known real-world documents have the same SHA-256 hash; finding a collision intentionally requires an amount of computation that is currently beyond any known attack. However, from a theoretical standpoint, collisions must exist (infinite inputs, finite outputs). SHA-256 is collision-resistant in practice, not collision-proof in theory. We never claim it is "impossible to collide" or "100% secure" — only that it is collision-resistant by current cryptographic standards.

---

## Q17: What does the on-chain timestamp prove?

The on-chain timestamp is `block.timestamp` at the time the `notarize()` transaction was mined. It proves that the document hash was recorded on the blockchain no later than that block time. It does not prove when the document was written, authored, or signed. Validators (miners/block proposers) can manipulate `block.timestamp` by a few seconds, so it is not a precise clock — but it provides a lower bound: the document definitely existed before the timestamp. In the UI and API responses, we always display this as "Recorded on-chain at ⟨time⟩".

---

## Q18: What are the system's limitations?

1. **Local chain only** — no public blockchain, no persistence across restarts.
2. **Unencrypted PDF storage** — files are stored in plain text on disk.
3. **Notary identity** — linked only to a wallet; not verified against Aadhaar, DSC, or any government registry.
4. **JWT in localStorage** — accessible to JavaScript; vulnerable to XSS in a production environment.
5. **No IPFS** — the `ipfsCid` field is always empty; decentralized document storage is not implemented.
6. **No legal validity** — the certificate explicitly disclaims legal standing.
7. **One node** — not decentralized; all data is on one machine.

---

## Q19: What future work is planned?

1. **IPFS with file encryption** for decentralized, private document storage.
2. **Public testnet or permissioned chain** (e.g., Sepolia or Hyperledger) for persistence and real decentralization.
3. **DSC or Aadhaar eSign** integration for legally recognized notary identity.
4. **Per-document audit logs** stored on-chain as events.
5. **HttpOnly cookie sessions** instead of localStorage JWTs.
6. **Multi-notary and multi-organization** support.

---

## Q20: What was tested?

- **Smart contract (128 Hardhat/Mocha assertions):** deployment, `addNotary`/`removeNotary`, `notarize`, duplicate prevention, access control errors, `getDocument`, `verify`, `exists`, `getDocumentsByOwner`.
- **Backend smoke tests (~27 assertions):** auth register/login/me, wallet nonce/link, document upload, stats, list, detail, file stream, notarization request, ownership isolation, rate limiting.
- **Backend chain tests (31 assertions):** full approve→MetaMask→confirm flow, receipt verification edge cases (wrong contract, wrong signer, wrong hash, reverted tx, reused hash), admin routes, verify endpoint with real and modified PDFs.
- **RBAC matrix (26 endpoints):** every API endpoint called as anonymous, USER, NOTARY, and ADMIN; result compared to the expected status in `docs/API_CONTRACT.md`; ownership isolation (5 routes return 404 to a stranger); sensitive-field leak check (0 exposures of `passwordHash`, `walletNonce`).
