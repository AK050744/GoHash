// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title DocumentNotary
 * @notice Blockchain-based digital notarization of documents.
 *
 *         Key design decisions
 *         ─────────────────────
 *         • A single contract owner (deployer) manages the set of authorized
 *           notary wallet addresses.
 *         • Only authorized notaries may call `notarize()`.
 *         • Each document record stores: SHA-256 hash, IPFS CID, document
 *           owner address, notary address, and block timestamp.
 *         • A document hash can only be notarized once (duplicate guard).
 *         • Full retrieval and existence-check helpers are provided.
 *
 * @dev Documents are never stored on-chain — only their cryptographic hash
 *      and an IPFS content identifier (CID) pointing to off-chain storage.
 */
contract DocumentNotary {
    // ─── Structs ──────────────────────────────────────────────────────────────

    struct NotarizedDocument {
        bytes32 documentHash; // SHA-256 hash of the document (bytes32)
        string  ipfsCid;      // IPFS CID where the document is stored off-chain
        address owner;        // Address that owns / submitted the document
        address notary;       // Authorized notary who performed the notarization
        uint256 timestamp;    // Block timestamp at the time of notarization
        bool    exists;       // Existence guard — always true once written
    }

    // ─── State ────────────────────────────────────────────────────────────────

    /// @notice Address that deployed the contract and manages notary access.
    address public contractOwner;

    /// @dev documentHash → NotarizedDocument
    mapping(bytes32 => NotarizedDocument) private _documents;

    /// @dev owner address → list of document hashes they submitted
    mapping(address => bytes32[]) private _ownerDocuments;

    /// @dev notary address → authorized flag
    mapping(address => bool) private _notaries;

    // ─── Events ───────────────────────────────────────────────────────────────

    /**
     * @notice Emitted whenever a document is successfully notarized.
     * @param documentHash SHA-256 hash of the document.
     * @param ipfsCid      IPFS CID where the document is stored.
     * @param owner        Address that owns the document.
     * @param notary       Authorized notary that performed the notarization.
     * @param timestamp    Block timestamp at notarization.
     */
    event DocumentNotarized(
        bytes32 indexed documentHash,
        string          ipfsCid,
        address indexed owner,
        address indexed notary,
        uint256         timestamp
    );

    /**
     * @notice Emitted when a notary address is authorized.
     * @param notary  The newly authorized notary address.
     * @param addedBy The contract owner who authorized it.
     */
    event NotaryAdded(address indexed notary, address indexed addedBy);

    /**
     * @notice Emitted when a notary address is revoked.
     * @param notary    The revoked notary address.
     * @param removedBy The contract owner who revoked it.
     */
    event NotaryRemoved(address indexed notary, address indexed removedBy);

    // ─── Custom Errors ────────────────────────────────────────────────────────

    error NotContractOwner(address caller);
    error NotAuthorizedNotary(address caller);
    error DocumentAlreadyNotarized(bytes32 documentHash);
    error DocumentNotFound(bytes32 documentHash);
    error InvalidHash();
    error InvalidAddress();
    error NotaryAlreadyAuthorized(address notary);
    error NotaryNotFound(address notary);

    // ─── Modifiers ────────────────────────────────────────────────────────────

    modifier onlyOwner() {
        if (msg.sender != contractOwner) revert NotContractOwner(msg.sender);
        _;
    }

    modifier onlyNotary() {
        if (!_notaries[msg.sender]) revert NotAuthorizedNotary(msg.sender);
        _;
    }

    // ─── Constructor ──────────────────────────────────────────────────────────

    /**
     * @notice Deploys the contract. The deployer becomes the contract owner.
     * @dev    The owner itself is NOT automatically an authorized notary;
     *         call `addNotary(owner)` explicitly if desired.
     */
    constructor() {
        contractOwner = msg.sender;
    }

    // ─── Owner: Notary Management ─────────────────────────────────────────────

    /**
     * @notice Authorize a wallet address to act as a notary.
     * @param notary The address to authorize.
     */
    function addNotary(address notary) external onlyOwner {
        if (notary == address(0)) revert InvalidAddress();
        if (_notaries[notary]) revert NotaryAlreadyAuthorized(notary);

        _notaries[notary] = true;
        emit NotaryAdded(notary, msg.sender);
    }

    /**
     * @notice Revoke notary authorization from a wallet address.
     * @param notary The address to revoke.
     */
    function removeNotary(address notary) external onlyOwner {
        if (notary == address(0)) revert InvalidAddress();
        if (!_notaries[notary]) revert NotaryNotFound(notary);

        _notaries[notary] = false;
        emit NotaryRemoved(notary, msg.sender);
    }

    /**
     * @notice Check whether an address is an authorized notary.
     * @param notary Address to query.
     * @return True if the address is an active authorized notary.
     */
    function isNotary(address notary) external view returns (bool) {
        return _notaries[notary];
    }

    // ─── Notary: Document Notarization ────────────────────────────────────────

    /**
     * @notice Notarize a document on-chain. Only callable by an authorized notary.
     * @param documentHash SHA-256 hash of the document, represented as bytes32.
     * @param ipfsCid      IPFS content identifier (CIDv0 or CIDv1) of the stored document.
     * @param owner        Address of the individual or entity that owns the document.
     *
     * @dev The caller (notary) is recorded separately from the document owner.
     *      Reverts if:
     *        • `documentHash` is the zero hash
     *        • `owner` is the zero address
     *        • `documentHash` has already been notarized
     */
    function notarize(
        bytes32 documentHash,
        string  calldata ipfsCid,
        address owner
    ) external onlyNotary {
        if (documentHash == bytes32(0)) revert InvalidHash();
        if (owner == address(0)) revert InvalidAddress();
        if (_documents[documentHash].exists) revert DocumentAlreadyNotarized(documentHash);

        _documents[documentHash] = NotarizedDocument({
            documentHash: documentHash,
            ipfsCid:      ipfsCid,
            owner:        owner,
            notary:       msg.sender,
            timestamp:    block.timestamp,
            exists:       true
        });

        _ownerDocuments[owner].push(documentHash);

        emit DocumentNotarized(documentHash, ipfsCid, owner, msg.sender, block.timestamp);
    }

    // ─── View: Retrieval & Verification ──────────────────────────────────────

    /**
     * @notice Retrieve the full notarization record for a document.
     * @param documentHash SHA-256 hash to look up.
     * @return documentHash_ The hash that was notarized (echoed back).
     * @return ipfsCid_      IPFS CID of the stored document.
     * @return owner_        Address that owns the document.
     * @return notary_       Authorized notary that performed the notarization.
     * @return timestamp_    Unix timestamp of notarization.
     */
    function getDocument(bytes32 documentHash)
        external
        view
        returns (
            bytes32 documentHash_,
            string  memory ipfsCid_,
            address owner_,
            address notary_,
            uint256 timestamp_
        )
    {
        if (!_documents[documentHash].exists) revert DocumentNotFound(documentHash);

        NotarizedDocument storage doc = _documents[documentHash];
        return (doc.documentHash, doc.ipfsCid, doc.owner, doc.notary, doc.timestamp);
    }

    /**
     * @notice Verify that a document hash is notarized and return its key metadata.
     * @param documentHash SHA-256 hash to verify.
     * @return owner_     Address that owns the document.
     * @return notary_    Authorized notary that performed the notarization.
     * @return timestamp_ Unix timestamp of notarization.
     * @return ipfsCid_   IPFS CID of the stored document.
     */
    function verify(bytes32 documentHash)
        external
        view
        returns (
            address owner_,
            address notary_,
            uint256 timestamp_,
            string  memory ipfsCid_
        )
    {
        if (!_documents[documentHash].exists) revert DocumentNotFound(documentHash);

        NotarizedDocument storage doc = _documents[documentHash];
        return (doc.owner, doc.notary, doc.timestamp, doc.ipfsCid);
    }

    /**
     * @notice Check if a document hash has been notarized.
     * @param documentHash SHA-256 hash to check.
     * @return True if the document has been notarized.
     */
    function exists(bytes32 documentHash) external view returns (bool) {
        return _documents[documentHash].exists;
    }

    /**
     * @notice Return all document hashes associated with a given owner address.
     * @param owner Address to query.
     * @return Array of document hashes owned by the given address.
     */
    function getDocumentsByOwner(address owner) external view returns (bytes32[] memory) {
        return _ownerDocuments[owner];
    }

    /**
     * @notice Return all document hashes associated with the caller's address.
     * @return Array of document hashes owned by msg.sender.
     */
    function getMyDocuments() external view returns (bytes32[] memory) {
        return _ownerDocuments[msg.sender];
    }
}
