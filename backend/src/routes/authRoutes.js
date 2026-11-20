import { Router } from 'express';
import * as auth from '../controllers/authController.js';
import { requireAuth } from '../middlewares/auth.js';
import { limiter, validateBody } from '../middlewares/common.js';
import { activateSchema, forgotPasswordSchema, loginSchema, resetPasswordSchema } from '../validators/schemas.js';

// Organiza las rutas de sesión, activación de cuentas y recuperación de contraseña.
const router = Router();
const loginLimiter = limiter({ name: 'login', windowMinutes: 15, max: 20 });

router.post('/login', loginLimiter, validateBody(loginSchema), auth.login);
router.post('/activate', loginLimiter, validateBody(activateSchema), auth.activate);
router.post('/password/forgot', loginLimiter, validateBody(forgotPasswordSchema), auth.forgotPassword);
router.post('/password/reset', loginLimiter, validateBody(resetPasswordSchema), auth.resetPassword);
router.post('/logout', requireAuth, auth.logout);
router.get('/me', requireAuth, auth.me);
router.get('/csrf', auth.csrf);
export default router;
