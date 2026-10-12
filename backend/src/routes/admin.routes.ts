/**
 * routes/admin.routes.ts
 * All routes require ADMIN role.
 */
import { Router } from 'express'
import { requireAuth, requireRole } from '../middleware/auth.middleware'
import { validate, validateBody } from '../middleware/validate'
import {
  listUsers,
  changeUserRole,
  changeUserStatus,
  listNotaries,
  getActivity,
  getStats,
} from '../controllers/admin.controller'
import {
  listUsersQuerySchema,
  adminUserIdParamSchema,
  changeRoleSchema,
  changeStatusSchema,
} from '../validations/admin.validation'

const router = Router()

// All admin routes require a valid JWT AND the ADMIN role
router.use(requireAuth, requireRole('ADMIN'))

router.get('/users',              validate(listUsersQuerySchema, 'query'), listUsers)
router.patch('/users/:id/role',   validate(adminUserIdParamSchema, 'params'), validateBody(changeRoleSchema), changeUserRole)
router.patch('/users/:id/status', validate(adminUserIdParamSchema, 'params'), validateBody(changeStatusSchema), changeUserStatus)
router.get('/notaries',           listNotaries)
router.get('/activity',           getActivity)
router.get('/stats',              getStats)

export default router
