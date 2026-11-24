import { Router } from 'express';
import * as integration from '../controllers/integrationController.js';
import { requireAuth, requireRole } from '../middlewares/auth.js';
import { limiter, validateBody } from '../middlewares/common.js';
import { requireIntegrationKey } from '../middlewares/integrationAuth.js';
import { exchangeRateInSchema, notifiedSchema, reminderDeliveriesSchema } from '../validators/schemas.js';

// APIs externas (tipo de cambio y feriados) y endpoints que consumen los workflows de n8n.
const router = Router();
const external = limiter({ name: 'external', windowMinutes: 1, max: 30 });
const n8n = limiter({ name: 'n8n', windowMinutes: 1, max: 60 });

router.get('/indicators/exchange-rate', requireAuth, external, integration.exchangeRate);
router.get('/indicators/holidays', requireAuth, external, integration.publicHolidays);
router.get('/institution/ai-cost', requireRole('institution_admin', 'auditor'), integration.costEstimate);

router.post('/integrations/exchange-rates', n8n, requireIntegrationKey, validateBody(exchangeRateInSchema), integration.receiveRate);
router.get('/integrations/daily-reminders', n8n, requireIntegrationKey, integration.reminders);
router.post('/integrations/daily-reminders/deliveries', n8n, requireIntegrationKey, validateBody(reminderDeliveriesSchema), integration.reminderDeliveries);
router.post('/integrations/deletion-requests/:requestId/process', n8n, requireIntegrationKey, integration.processDeletion);
router.post('/integrations/deletion-requests/:requestId/notified', n8n, requireIntegrationKey, validateBody(notifiedSchema), integration.deletionNotified);
export default router;
