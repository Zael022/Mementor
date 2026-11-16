import { Router } from 'express';
import * as drive from '../controllers/driveController.js';
import { requireRole } from '../middlewares/auth.js';
import { limiter, validateBody } from '../middlewares/common.js';
import { driveFolderSchema, driveLinkSchema } from '../validators/schemas.js';

// Rutas de Google Drive: la institución habilita carpetas y el curso vincula una.
const router = Router();
const institution = requireRole('institution_admin');
const staff = requireRole('institution_admin', 'teacher');
const syncLimiter = limiter({ name: 'drive-sync', windowMinutes: 1, max: 6 });

router.get('/institution/drive-folders', institution, drive.listFolders);
router.post('/institution/drive-folders', institution, validateBody(driveFolderSchema), drive.addFolder);
router.post('/institution/drive-folders/:folderId/disable', institution, drive.disableFolder);

router.get('/courses/:courseId/drive', staff, drive.courseDrive);
router.put('/courses/:courseId/drive', staff, validateBody(driveLinkSchema), drive.linkFolder);
router.delete('/courses/:courseId/drive', staff, drive.unlinkFolder);
router.post('/courses/:courseId/drive/sync', staff, syncLimiter, drive.syncNow);
export default router;
