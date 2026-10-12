import { z } from 'zod'

export const listUsersQuerySchema = z.object({
  role: z.enum(['USER', 'NOTARY', 'ADMIN']).optional(),
  q: z.string().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
})

export const adminUserIdParamSchema = z.object({
  id: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid user ID format'),
})

export const changeRoleSchema = z.object({
  role: z.enum(['USER', 'NOTARY', 'ADMIN']),
})

export const changeStatusSchema = z.object({
  isActive: z.boolean(),
})
