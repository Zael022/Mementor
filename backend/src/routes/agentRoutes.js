import { Router } from 'express';
import * as agents from '../controllers/agentController.js';
import { requireRole } from '../middlewares/auth.js';
import { limiter } from '../middlewares/common.js';

// Agentes de IA: catálogo por rol, ejecución y bitácora. Cada agente vuelve a validar el rol y el recurso.
const router = Router();
const members = requireRole('institution_admin', 'teacher', 'student', 'auditor');
const runLimiter = limiter({ name: 'agents', windowMinutes: 1, max: 10 });

router.get('/agents', members, agents.catalog);
router.post('/agents/:key/run', members, runLimiter, agents.run);
router.get('/agents/runs', members, agents.myRuns);
router.get('/governance/agent-runs', requireRole('institution_admin', 'auditor'), agents.institutionRuns);
export default router;
