import { Router } from 'express';
import * as workspace from '../controllers/workspaceController.js';
import { requireAuth, requireRole } from '../middlewares/auth.js';
import { validateBody } from '../middlewares/common.js';
import { profileSchema } from '../validators/schemas.js';

// Vistas de trabajo diario: personas del curso, calendario, pendientes y perfil.
const router = Router();
const member = requireRole('institution_admin', 'teacher', 'student');

router.get('/courses/:courseId/people', requireAuth, workspace.people);
router.get('/me/calendar', member, workspace.calendar);
router.get('/me/todo', member, workspace.todo);
router.patch('/me/profile', requireAuth, validateBody(profileSchema), workspace.updateProfile);
export default router;
