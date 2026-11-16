import { Router } from 'express';
import * as classroom from '../controllers/classroomController.js';
import { requireAuth, requireRole } from '../middlewares/auth.js';
import { limiter, validateBody } from '../middlewares/common.js';
import { receiveFile } from '../middlewares/upload.js';
import {
  announcementSchema, assignmentSchema, commentSchema, gradeSchema, materialLinkSchema, sessionSchema,
  submissionSchema, updateAssignmentSchema, updateSessionSchema,
} from '../validators/schemas.js';

// Organiza las rutas del aula; el permiso por curso se valida en los servicios.
const router = Router();
const staff = requireRole('institution_admin', 'teacher');
const student = requireRole('student');
const writeLimiter = limiter({ name: 'classroom-write', windowMinutes: 1, max: 30 });

router.get('/courses/:courseId/sessions', requireAuth, classroom.listSessions);
router.post('/courses/:courseId/sessions', staff, validateBody(sessionSchema), classroom.createSession);
router.patch('/sessions/:sessionId', staff, validateBody(updateSessionSchema), classroom.updateSession);
router.delete('/sessions/:sessionId', staff, classroom.deleteSession);
router.post('/sessions/:sessionId/join', requireAuth, classroom.joinSession);
router.get('/sessions/:sessionId/attendance', staff, classroom.sessionAttendance);

router.get('/courses/:courseId/announcements', requireAuth, classroom.listAnnouncements);
router.post('/courses/:courseId/announcements', staff, validateBody(announcementSchema), classroom.createAnnouncement);
router.delete('/announcements/:announcementId', staff, classroom.deleteAnnouncement);

router.get('/courses/:courseId/materials', requireAuth, classroom.listMaterials);
router.post('/courses/:courseId/materials', staff, validateBody(materialLinkSchema), classroom.createLinkMaterial);
router.post('/courses/:courseId/materials/upload', staff, writeLimiter, receiveFile, classroom.uploadMaterial);
router.get('/materials/:materialId/download', requireAuth, classroom.downloadMaterial);
router.delete('/materials/:materialId', staff, classroom.deleteMaterial);

router.get('/lessons/:lessonId/comments', requireAuth, classroom.listComments);
router.post('/lessons/:lessonId/comments', requireAuth, writeLimiter, validateBody(commentSchema), classroom.createComment);
router.delete('/comments/:commentId', requireAuth, classroom.deleteComment);

router.get('/courses/:courseId/assignments', requireAuth, classroom.listAssignments);
router.post('/courses/:courseId/assignments', staff, validateBody(assignmentSchema), classroom.createAssignment);
router.get('/assignments/:assignmentId', requireAuth, classroom.getAssignment);
router.patch('/assignments/:assignmentId', staff, validateBody(updateAssignmentSchema), classroom.updateAssignment);
router.delete('/assignments/:assignmentId', staff, classroom.deleteAssignment);
router.post('/assignments/:assignmentId/submission', student, validateBody(submissionSchema), classroom.submitAssignment);
router.patch('/submissions/:submissionId/grade', staff, validateBody(gradeSchema), classroom.gradeSubmission);

router.get('/me/home', student, classroom.studentHome);
export default router;
