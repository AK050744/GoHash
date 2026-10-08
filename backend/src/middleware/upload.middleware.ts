import multer from 'multer'
import { Request, Response, NextFunction } from 'express'
import { env } from '../config/env'

const memoryStorage = multer.memoryStorage()

const uploader = multer({
  storage: memoryStorage,
  limits: {
    fileSize: env.MAX_FILE_SIZE_MB * 1024 * 1024,
  },
})

/**
 * Upload middleware accepting either 'file' or 'document' field in multipart/form-data.
 * Limits file size to MAX_FILE_SIZE_MB and buffers into memory for SHA-256 calculation.
 */
export function uploadPdfMiddleware(req: Request, res: Response, next: NextFunction): void {
  uploader.fields([
    { name: 'file', maxCount: 1 },
    { name: 'document', maxCount: 1 },
  ])(req, res, (err) => {
    if (err) {
      return next(err)
    }
    const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined
    if (files) {
      if (files['file'] && files['file'][0]) {
        req.file = files['file'][0]
      } else if (files['document'] && files['document'][0]) {
        req.file = files['document'][0]
      }
    }
    next()
  })
}
