import { z } from 'zod'

export const requestNotarizationSchema = z.object({
  documentId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid document ID format'),
})

export const notarizationIdParamSchema = z.object({
  id: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid notarization ID format'),
})

export const confirmNotarizationSchema = z.object({
  transactionHash: z.string().regex(/^0x[a-fA-F0-9]{64}$/, 'Invalid transaction hash format'),
})

export const rejectNotarizationSchema = z.object({
  reason: z
    .string()
    .min(1, 'reason is required')
    .refine((val) => val.trim().length > 0, {
      message: 'reason is required',
    }),
})

export const getNotarizationsQuerySchema = z.object({
  status: z.enum(['REQUESTED', 'APPROVED', 'CONFIRMED', 'REJECTED', 'FAILED']).optional(),
})
