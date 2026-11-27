import { Router } from 'express';
import * as game from '../controllers/gamificationController.js';
import { requireAuth, requireRole } from '../middlewares/auth.js';
import { limiter, validateBody } from '../middlewares/common.js';
import {
  classWorkGradesSchema, classWorkItemSchema, dailyAnswerSchema, gradePolicySchema, memoryGameSchema, memoryMatchSchema, memoryRevealSchema,
  quickAnswerSchema, quickQuestionSchema, quickQuizSchema, updateQuickQuizSchema,
} from '../validators/schemas.js';

// Rutas de nota del curso (trabajo en clase y pesos), quizzes rápidos, práctica diaria con racha y Parejas.
const router = Router();
const staff = requireRole('institution_admin', 'teacher');
const student = requireRole('student');
// Limita respuestas automáticas: un juego real no necesita más de una por segundo.
const playLimiter = limiter({ name: 'quiz-play', windowMinutes: 1, max: 90 });
// Parejas: voltear y comparar cartas a ritmo humano.
const memoryLimiter = limiter({ name: 'memory-game', windowMinutes: 1, max: 120 });

router.post('/courses/:courseId/quick-quizzes', staff, validateBody(quickQuizSchema), game.createQuiz);
router.get('/courses/:courseId/quick-quizzes', requireAuth, game.listQuizzes);
router.get('/quick-quizzes/:quizId', staff, game.getQuiz);
router.patch('/quick-quizzes/:quizId', staff, validateBody(updateQuickQuizSchema), game.updateQuiz);
router.delete('/quick-quizzes/:quizId', staff, game.deleteQuiz);
router.post('/quick-quizzes/:quizId/questions', staff, validateBody(quickQuestionSchema), game.addQuestion);
router.delete('/quick-questions/:questionId', staff, game.deleteQuestion);
router.post('/quick-quizzes/:quizId/publish', staff, game.publishQuiz);
router.post('/quick-quizzes/:quizId/archive', staff, game.archiveQuiz);

router.post('/quick-quizzes/:quizId/plays', student, playLimiter, game.startPlay);
router.post('/quiz-plays/:playId/next', student, playLimiter, game.nextQuestion);
router.post('/quiz-plays/:playId/answers', student, playLimiter, validateBody(quickAnswerSchema), game.answerQuestion);
router.get('/quiz-plays/:playId', requireAuth, game.playResult);

router.get('/courses/:courseId/daily-practice', student, game.todayPractice);
router.post('/courses/:courseId/daily-practice/answers', student, playLimiter, validateBody(dailyAnswerSchema), game.answerDaily);

router.post('/modules/:moduleId/memory-games', student, memoryLimiter, validateBody(memoryGameSchema), game.startMemoryGame);
router.get('/memory-games/:gameId', student, game.getMemoryGame);
router.post('/memory-games/:gameId/reveal', student, memoryLimiter, validateBody(memoryRevealSchema), game.revealMemoryCard);
router.post('/memory-games/:gameId/match', student, memoryLimiter, validateBody(memoryMatchSchema), game.matchMemoryCards);

router.get('/courses/:courseId/my-grade', student, game.myGrade);
router.get('/courses/:courseId/grades', staff, game.courseGrades);
router.put('/courses/:courseId/grade-policy', staff, validateBody(gradePolicySchema), game.savePolicy);

router.post('/courses/:courseId/class-work', staff, validateBody(classWorkItemSchema), game.createClassWork);
router.get('/courses/:courseId/class-work', requireAuth, game.listClassWork);
router.delete('/class-work/:itemId', staff, game.deleteClassWork);
router.put('/class-work/:itemId/grades', staff, validateBody(classWorkGradesSchema), game.saveClassWorkGrades);
export default router;
