import { Router } from 'express';
import * as course from '../controllers/courseController.js';
import { requireAuth, requireRole } from '../middlewares/auth.js';
import { validateBody } from '../middlewares/common.js';
import {
  courseSchema, enrollSchema, lessonSchema, moduleSchema, prerequisitesSchema, topicSchema,
  updateCourseSchema, updateLessonSchema, userRefSchema,
} from '../validators/schemas.js';

// Organiza las rutas de cursos y contenido; el permiso por curso se valida en los servicios.
const router = Router();
const staff = requireRole('institution_admin', 'teacher');

router.get('/courses', requireAuth, course.list);
router.post('/courses', staff, validateBody(courseSchema), course.create);
router.get('/courses/:courseId', requireAuth, course.detail);
router.patch('/courses/:courseId', staff, validateBody(updateCourseSchema), course.update);

router.post('/courses/:courseId/teachers', requireRole('institution_admin'), validateBody(userRefSchema), course.assignTeacher);
router.delete('/courses/:courseId/teachers/:userId', requireRole('institution_admin'), course.removeTeacher);
router.get('/courses/:courseId/enrollments', staff, course.listEnrollments);
router.get('/courses/:courseId/enrollable-students', staff, course.listEnrollableStudents);
router.post('/courses/:courseId/enrollments', staff, validateBody(enrollSchema), course.enroll);
router.delete('/courses/:courseId/enrollments/:enrollmentId', staff, course.withdraw);

router.post('/courses/:courseId/modules', staff, validateBody(moduleSchema), course.createModule);
router.patch('/modules/:moduleId', staff, validateBody(moduleSchema), course.updateModule);
router.delete('/modules/:moduleId', staff, course.deleteModule);

router.post('/modules/:moduleId/topics', staff, validateBody(topicSchema), course.createTopic);
router.patch('/topics/:topicId', staff, validateBody(topicSchema), course.updateTopic);
router.delete('/topics/:topicId', staff, course.deleteTopic);
router.put('/topics/:topicId/prerequisites', staff, validateBody(prerequisitesSchema), course.setPrerequisites);

router.post('/topics/:topicId/lessons', staff, validateBody(lessonSchema), course.createLesson);
router.get('/topics/:topicId/lessons', requireAuth, course.listLessons);
router.get('/lessons/:lessonId', requireAuth, course.getLesson);
router.patch('/lessons/:lessonId', staff, validateBody(updateLessonSchema), course.updateLesson);
router.delete('/lessons/:lessonId', staff, course.deleteLesson);
router.post('/lessons/:lessonId/complete', requireRole('student'), course.completeLesson);
export default router;
