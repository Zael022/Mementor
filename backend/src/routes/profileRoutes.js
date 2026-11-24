import { Router } from 'express';
import * as profile from '../controllers/profileController.js';
import { requireAuth } from '../middlewares/auth.js';
import { limiter, validateBody } from '../middlewares/common.js';
import { receiveAvatar } from '../middlewares/upload.js';
import { emailChangeSchema, passwordChangeSchema, profileSchema } from '../validators/schemas.js';

// Perfil propio: datos personales, contraseña, correo y foto.
const router = Router();
// Los cambios que piden la contraseña actual tienen un límite propio además del bloqueo de la cuenta.
const sensitiveLimiter = limiter({ name: 'credentials', windowMinutes: 15, max: 10 });
// Tope por cuenta para cambios de contraseña y correo, independiente de la IP.
const perAccount = limiter({ name: 'credentials-account', windowMinutes: 60, max: 10, key: (req) => String(req.user.id) });
const avatarLimiter = limiter({ name: 'avatar', windowMinutes: 10, max: 20 });

router.get('/me/profile', requireAuth, profile.getProfile);
router.patch('/me/profile', requireAuth, validateBody(profileSchema), profile.updateProfile);
router.post('/me/password', requireAuth, sensitiveLimiter, perAccount, validateBody(passwordChangeSchema), profile.changePassword);
router.post('/me/email', requireAuth, sensitiveLimiter, perAccount, validateBody(emailChangeSchema), profile.changeEmail);
router.post('/me/avatar', requireAuth, avatarLimiter, receiveAvatar, profile.uploadAvatar);
router.delete('/me/avatar', requireAuth, profile.deleteAvatar);
router.get('/users/:userId/avatar', requireAuth, profile.avatar);
export default router;
