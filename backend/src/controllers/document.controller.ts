import { Request, Response, NextFunction } from 'express'
import { NotarizedDocument } from '../models/Document.model'
import { getNotaryContract } from '../config/blockchain'
import { ethers } from 'ethers'

// ─── POST /api/documents/notarize ────────────────────────────────────────────
export async function notarizeDocument(req: Request, res: Response, next: NextFunction) {
  try {
    const { documentHash, description, fileName, mimeType, fileSize } = req.body
    const userId = (req as any).userId

    // Check for duplicate in MongoDB
    const existing = await NotarizedDocument.findOne({ documentHash })
    if (existing) {
      return res.status(409).json({ message: 'Document already notarized', document: existing })
    }

    // Create DB record as pending
    const doc = await NotarizedDocument.create({
      owner:        userId,
      fileName:     fileName || 'unknown',
      mimeType:     mimeType || 'application/octet-stream',
      fileSize:     fileSize || 0,
      documentHash,
      description:  description || '',
      status:       'pending',
    })

    // Submit to blockchain
    // Day-02 contract: notarize(bytes32 hash, string ipfsCid, address owner)
    const contract    = getNotaryContract()
    const bytes32Hash = documentHash.startsWith('0x') ? documentHash : `0x${documentHash}`
    const ownerWallet = req.body.ownerAddress || ethers.ZeroAddress
    const ipfsCid     = req.body.ipfsCid     || ''
    const tx          = await contract.notarize(bytes32Hash, ipfsCid, ownerWallet)
    const receipt     = await tx.wait()

    // Update DB record with on-chain details
    doc.status      = 'notarized'
    doc.txHash      = receipt.hash
    doc.blockNumber = receipt.blockNumber
    doc.notarizedAt = new Date()
    await doc.save()

    return res.status(201).json({
      message:  'Document notarized successfully',
      document: doc,
      tx: {
        hash:        receipt.hash,
        blockNumber: receipt.blockNumber,
      },
    })
  } catch (err) {
    next(err)
  }
}

// ─── GET /api/documents/verify/:hash ─────────────────────────────────────────
export async function verifyDocument(req: Request, res: Response, next: NextFunction) {
  try {
    const { hash } = req.params
    const bytes32Hash = hash.startsWith('0x') ? hash : `0x${hash}`

    // Check on-chain
    const contract = getNotaryContract()
    const onChain  = await contract.exists(bytes32Hash)

    if (!onChain) {
      return res.status(404).json({ verified: false, message: 'Document not found on blockchain' })
    }

    // Day-02 verify() returns: (address owner, address notary, uint256 timestamp, string ipfsCid)
    const [owner, notary, timestamp, ipfsCid] = await contract.verify(bytes32Hash)

    // Fetch MongoDB record (optional — may not exist for externally notarized docs)
    const dbRecord = await NotarizedDocument.findOne({ documentHash: hash })

    return res.json({
      verified: true,
      onChain: {
        owner,
        notary,
        ipfsCid,
        timestamp:   Number(timestamp),
        notarizedAt: new Date(Number(timestamp) * 1000).toISOString(),
      },
      dbRecord: dbRecord || null,
    })
  } catch (err) {
    next(err)
  }
}

// ─── GET /api/documents ───────────────────────────────────────────────────────
export async function getMyDocuments(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = (req as any).userId
    const docs = await NotarizedDocument.find({ owner: userId }).sort({ createdAt: -1 })
    return res.json({ documents: docs })
  } catch (err) {
    next(err)
  }
}

// ─── GET /api/documents/:id ───────────────────────────────────────────────────
export async function getDocumentById(req: Request, res: Response, next: NextFunction) {
  try {
    const doc = await NotarizedDocument.findById(req.params.id).populate('owner', 'name email')
    if (!doc) return res.status(404).json({ message: 'Document not found' })
    return res.json({ document: doc })
  } catch (err) {
    next(err)
  }
}
