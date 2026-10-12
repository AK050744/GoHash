import { z } from 'zod'

export const getDocumentsQuerySchema = z.object({
  status: z.enum(['PENDING', 'APPROVED', 'REJECTED', 'NOTARIZED']).optional(),
})

export const documentIdParamSchema = z.object({
  id: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid document ID format'),
})
