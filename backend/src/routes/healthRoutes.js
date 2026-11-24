import { Router } from 'express';
import { health } from '../controllers/healthController.js';
import { requireRole } from '../middlewares/auth.js';
import { metricsSnapshot } from '../utils/requestMetrics.js';

// Organiza las rutas de monitoreo.
const router = Router();
router.get('/health', health);
// Latencia y errores de esta instancia; solo para quien opera la plataforma.
router.get('/ops/metrics', requireRole('platform_admin'), (req, res) => res.json({ data: metricsSnapshot() }));
export default router;
