import { z } from 'zod'

export const blockchainDocParamSchema = z.object({
  documentId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid document ID format'),
})
