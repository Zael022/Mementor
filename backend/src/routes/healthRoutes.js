import { Router } from 'express';
import { health } from '../controllers/healthController.js';

// Organiza las rutas de monitoreo.
const router = Router();
router.get('/health', health);
export default router;
