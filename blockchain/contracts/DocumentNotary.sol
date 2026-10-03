// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title DocumentNotary
 * @notice Records SHA-256 document hashes on-chain with a timestamp and owner address.
 *         Provides tamper-proof proof-of-existence for any document.
 * @dev Only stores a bytes32 hash — actual documents are never uploaded on-chain.
 */
contract DocumentNotary {
    // ─── Structs ──────────────────────────────────────────────────────────────

    struct NotarizedDocument {
        bytes32  documentHash;   // SHA-256 hash of the document (bytes32)
        address  owner;          // Address that notarized the document
        uint256  timestamp;      // Block timestamp at notarization
        string   description;    // Optional human-readable description
        bool     exists;         // Guard flag for existence checks
    }

    // ─── State ────────────────────────────────────────────────────────────────

    /// @dev hash → NotarizedDocument
    mapping(bytes32 => NotarizedDocument) private _documents;

    /// @dev owner address → list of hashes they notarized
    mapping(address => bytes32[]) private _ownerDocuments;

    // ─── Events ───────────────────────────────────────────────────────────────

    event DocumentNotarized(
        bytes32 indexed documentHash,
        address indexed owner,
        uint256 timestamp,
        string  description
    );

    // ─── Errors ───────────────────────────────────────────────────────────────

    error DocumentAlreadyNotarized(bytes32 documentHash);
    error DocumentNotFound(bytes32 documentHash);
    error InvalidHash();

    // ─── External Functions ───────────────────────────────────────────────────

    /**
     * @notice Notarize a document hash on-chain.
     * @param documentHash SHA-256 hash of the document as bytes32.
     * @param description  Optional short description of the document.
     */
    function notarize(bytes32 documentHash, string calldata description) external {
        if (documentHash == bytes32(0)) revert InvalidHash();
        if (_documents[documentHash].exists)
            revert DocumentAlreadyNotarized(documentHash);

        _documents[documentHash] = NotarizedDocument({
            documentHash: documentHash,
            owner:        msg.sender,
            timestamp:    block.timestamp,
            description:  description,
            exists:       true
        });

        _ownerDocuments[msg.sender].push(documentHash);

        emit DocumentNotarized(documentHash, msg.sender, block.timestamp, description);
    }

    /**
     * @notice Verify whether a document hash is notarized on-chain.
     * @param documentHash SHA-256 hash to verify.
     * @return owner_      Address that notarized the document.
     * @return timestamp_  Unix timestamp of notarization.
     * @return description_ Human-readable label set at notarization.
     */
    function verify(bytes32 documentHash)
        external
        view
        returns (
            address  owner_,
            uint256  timestamp_,
            string memory description_
        )
    {
        if (!_documents[documentHash].exists)
            revert DocumentNotFound(documentHash);

        NotarizedDocument storage doc = _documents[documentHash];
        return (doc.owner, doc.timestamp, doc.description);
    }

    /**
     * @notice Check if a document hash exists on-chain.
     * @param documentHash SHA-256 hash to check.
     * @return True if notarized.
     */
    function exists(bytes32 documentHash) external view returns (bool) {
        return _documents[documentHash].exists;
    }

    /**
     * @notice Return all document hashes notarized by the caller.
     */
    function getMyDocuments() external view returns (bytes32[] memory) {
        return _ownerDocuments[msg.sender];
    }

    /**
     * @notice Return all document hashes notarized by a given address.
     * @param owner Address to query.
     */
    function getDocumentsByOwner(address owner) external view returns (bytes32[] memory) {
        return _ownerDocuments[owner];
    }
}
