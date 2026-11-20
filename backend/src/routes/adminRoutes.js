import { Router } from 'express';
import * as admin from '../controllers/adminController.js';
import { requireRole } from '../middlewares/auth.js';
import { validateBody } from '../middlewares/common.js';
import { institutionSchema, inviteAdminSchema, inviteUserSchema, updateUserSchema } from '../validators/schemas.js';

// Organiza las rutas de administración.
const router = Router();
const platform = requireRole('platform_admin');
const institution = requireRole('institution_admin');

router.get('/institutions', platform, admin.listInstitutions);
router.post('/institutions', platform, validateBody(institutionSchema), admin.createInstitution);
router.get('/institutions/:institutionId/admins', platform, admin.listInstitutionAdmins);
router.post('/institutions/:institutionId/admins', platform, validateBody(inviteAdminSchema), admin.inviteInstitutionAdmin);

router.get('/users', institution, admin.listUsers);
router.post('/users', institution, validateBody(inviteUserSchema), admin.inviteUser);
router.patch('/users/:userId', requireRole('institution_admin', 'platform_admin'), validateBody(updateUserSchema), admin.updateUser);
router.post('/users/:userId/invitation', requireRole('institution_admin', 'platform_admin'), admin.renewInvitation);

// La auditoría tiene acceso de solo lectura a la bitácora de su institución.
router.get('/audit-logs', requireRole('institution_admin', 'platform_admin', 'auditor'), admin.auditLogs);
export default router;
