/**
 * routes/admin.routes.ts
 * All routes require ADMIN role.
 */
import { Router } from 'express'
import { requireAuth, requireRole } from '../middleware/auth.middleware'
import {
  listUsers,
  changeUserRole,
  changeUserStatus,
  listNotaries,
  getActivity,
  getStats,
} from '../controllers/admin.controller'

const router = Router()

// All admin routes require a valid JWT AND the ADMIN role
router.use(requireAuth, requireRole('ADMIN'))

router.get('/users',              listUsers)
router.patch('/users/:id/role',   changeUserRole)
router.patch('/users/:id/status', changeUserStatus)
router.get('/notaries',           listNotaries)
router.get('/activity',           getActivity)
router.get('/stats',              getStats)

export default router
