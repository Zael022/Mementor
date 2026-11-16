import { Router } from 'express';
import * as learning from '../controllers/learningController.js';
import { requireAuth, requireRole } from '../middlewares/auth.js';
import { limiter, validateBody } from '../middlewares/common.js';
import { assessmentSchema, questionSchema, submitSchema, threadSchema, tutorMessageSchema } from '../validators/schemas.js';

// Organiza las rutas de evaluaciones, progreso, analítica y tutor.
const router = Router();
const staff = requireRole('institution_admin', 'teacher');
const student = requireRole('student');
const participant = requireRole('student', 'teacher');
const tutorLimiter = limiter({ name: 'tutor', windowMinutes: 1, max: 10 });

router.post('/courses/:courseId/assessments', staff, validateBody(assessmentSchema), learning.createAssessment);
router.get('/courses/:courseId/assessments', requireAuth, learning.listAssessments);
router.get('/assessments/:assessmentId', requireAuth, learning.getAssessment);
router.post('/assessments/:assessmentId/questions', staff, validateBody(questionSchema), learning.addQuestion);
router.delete('/questions/:questionId', staff, learning.deleteQuestion);
router.post('/assessments/:assessmentId/publish', staff, learning.publishAssessment);
router.post('/assessments/:assessmentId/close', staff, learning.closeAssessment);

router.post('/assessments/:assessmentId/attempts', student, learning.startAttempt);
router.post('/attempts/:attemptId/submit', student, validateBody(submitSchema), learning.submitAttempt);
router.get('/attempts/:attemptId/result', requireAuth, learning.attemptResult);

router.get('/me/attempts', student, learning.myAttempts);
router.get('/me/mastery', student, learning.myMastery);
router.get('/me/recommendations', student, learning.myRecommendations);

router.get('/teacher/courses/:courseId/analytics', staff, learning.courseAnalytics);

router.get('/tutor/status', requireAuth, learning.tutorStatus);
router.post('/courses/:courseId/tutor/threads', participant, validateBody(threadSchema), learning.createThread);
router.get('/courses/:courseId/tutor/threads', participant, learning.listThreads);
router.get('/tutor/threads/:threadId/messages', participant, learning.listMessages);
router.post('/tutor/threads/:threadId/messages', participant, tutorLimiter, validateBody(tutorMessageSchema), learning.askTutor);
export default router;
