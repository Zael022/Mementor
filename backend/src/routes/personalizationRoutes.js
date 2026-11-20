import { Router } from 'express';
import * as personalization from '../controllers/personalizationController.js';
import { requireAuth, requireRole } from '../middlewares/auth.js';
import { validateBody } from '../middlewares/common.js';
import { preferencesSchema, selfReviewSchema, studyPlanItemSchema, studyPlanSchema } from '../validators/schemas.js';

// Preferencias de la cuenta, repaso espaciado y plan de estudio.
const router = Router();
const student = requireRole('student');

router.get('/me/preferences', requireAuth, personalization.getPreferences);
router.patch('/me/preferences', requireAuth, validateBody(preferencesSchema), personalization.updatePreferences);

router.get('/me/reviews', student, personalization.myReviews);
router.post('/topics/:topicId/reviews', student, validateBody(selfReviewSchema), personalization.selfReview);

router.get('/courses/:courseId/study-plan', student, personalization.activePlan);
router.post('/courses/:courseId/study-plan', student, validateBody(studyPlanSchema), personalization.createPlan);
router.patch('/study-plan-items/:itemId', student, validateBody(studyPlanItemSchema), personalization.updatePlanItem);
router.delete('/study-plans/:planId', student, personalization.archivePlan);
export default router;
