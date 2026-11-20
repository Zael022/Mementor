import { Router } from 'express';
import * as workspace from '../controllers/workspaceController.js';
import { requireAuth, requireRole } from '../middlewares/auth.js';

// Vistas de trabajo diario: personas del curso, calendario y pendientes (el perfil está en profileRoutes).
const router = Router();
const member = requireRole('institution_admin', 'teacher', 'student');

router.get('/courses/:courseId/people', requireAuth, workspace.people);
router.get('/me/calendar', member, workspace.calendar);
router.get('/me/todo', member, workspace.todo);
export default router;
