import { Router } from 'express';
import * as knowledge from '../controllers/knowledgeController.js';
import { requireRole } from '../middlewares/auth.js';
import { limiter, validateBody } from '../middlewares/common.js';
import { institutionLimitsSchema, tutorMessageSchema } from '../validators/schemas.js';

// Rutas de fuentes del tutor, citas, streaming y consumo; el permiso por curso se valida en los servicios.
const router = Router();
const staff = requireRole('institution_admin', 'teacher');
const participant = requireRole('student', 'teacher');
const tutorLimiter = limiter({ name: 'tutor-stream', windowMinutes: 1, max: 10 });
const syncLimiter = limiter({ name: 'knowledge-sync', windowMinutes: 1, max: 10 });

router.get('/courses/:courseId/knowledge', staff, knowledge.listSources);
router.post('/courses/:courseId/knowledge/index-existing', staff, syncLimiter, knowledge.indexExisting);
router.post('/knowledge/versions/:versionId/retry', staff, syncLimiter, knowledge.retryVersion);
router.post('/knowledge/sources/:sourceId/retire', staff, knowledge.retireSource);

router.get('/tutor/messages/:messageId/citations/:position', participant, knowledge.getCitation);
router.post('/tutor/threads/:threadId/messages/stream', participant, tutorLimiter, validateBody(tutorMessageSchema), knowledge.streamTutor);

router.get('/institution/ai-usage', requireRole('institution_admin'), knowledge.institutionUsage);
router.get('/institution/ai-usage/events', requireRole('institution_admin'), knowledge.usageEvents);
router.patch('/institutions/:institutionId/limits', requireRole('platform_admin'), validateBody(institutionLimitsSchema), knowledge.updateLimits);
export default router;
