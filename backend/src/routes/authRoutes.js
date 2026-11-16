import { Router } from 'express';
import * as auth from '../controllers/authController.js';
import { requireAuth } from '../middlewares/auth.js';
import { limiter, validateBody } from '../middlewares/common.js';
import { activateSchema, loginSchema } from '../validators/schemas.js';

// Organiza las rutas de sesión y activación de cuentas.
const router = Router();
const loginLimiter = limiter({ name: 'login', windowMinutes: 15, max: 20 });

router.post('/login', loginLimiter, validateBody(loginSchema), auth.login);
router.post('/activate', loginLimiter, validateBody(activateSchema), auth.activate);
router.post('/logout', requireAuth, auth.logout);
router.get('/me', requireAuth, auth.me);
router.get('/csrf', auth.csrf);
export default router;
