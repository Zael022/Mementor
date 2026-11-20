import { Router } from 'express';
import healthRoutes from './healthRoutes.js';
import authRoutes from './authRoutes.js';
import adminRoutes from './adminRoutes.js';
import courseRoutes from './courseRoutes.js';
import learningRoutes from './learningRoutes.js';
import classroomRoutes from './classroomRoutes.js';
import knowledgeRoutes from './knowledgeRoutes.js';
import driveRoutes from './driveRoutes.js';
import gamificationRoutes from './gamificationRoutes.js';
import workspaceRoutes from './workspaceRoutes.js';
import personalizationRoutes from './personalizationRoutes.js';
import profileRoutes from './profileRoutes.js';

// Reúne todas las rutas de la API.
const router = Router();
router.use(healthRoutes);
router.use('/auth', authRoutes);
router.use(adminRoutes);
router.use(courseRoutes);
router.use(learningRoutes);
router.use(classroomRoutes);
router.use(knowledgeRoutes);
router.use(driveRoutes);
router.use(gamificationRoutes);
router.use(workspaceRoutes);
router.use(personalizationRoutes);
router.use(profileRoutes);
export default router;
