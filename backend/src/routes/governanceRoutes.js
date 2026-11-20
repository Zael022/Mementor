import { Router } from 'express';
import * as governance from '../controllers/governanceController.js';
import { requireAuth, requireRole } from '../middlewares/auth.js';
import { limiter, validateBody } from '../middlewares/common.js';
import { consentSchema, deletionRequestSchema } from '../validators/schemas.js';

// Gobernanza de datos: documentos legales, consentimientos, copia de datos y baja de la cuenta.
const router = Router();
const sensitive = limiter({ name: 'deletion', windowMinutes: 15, max: 10 });
// Administración y auditoría consultan; la auditoría nunca modifica.
const oversight = requireRole('platform_admin', 'institution_admin', 'auditor');

router.get('/legal/versions', governance.versions);
router.get('/me/consents', requireAuth, governance.myConsents);
router.post('/me/consents', requireAuth, validateBody(consentSchema), governance.accept);
router.get('/me/data-export', requireAuth, governance.exportData);
router.post('/me/deletion-request', requireAuth, sensitive, validateBody(deletionRequestSchema), governance.requestDeletion);
router.get('/governance/deletion-requests', oversight, governance.deletionRequests);
router.get('/governance/consents', oversight, governance.consentSummary);
export default router;
