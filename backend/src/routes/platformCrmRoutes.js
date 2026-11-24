import { Router } from 'express';
import { z } from 'zod';
import { requireRole } from '../middlewares/auth.js';
import { validateBody } from '../middlewares/common.js';
import { invalid } from '../utils/AppError.js';
import * as crm from '../services/platformCrmService.js';

const router = Router();
const id = z.coerce.number().int().positive().safe();
const pagination = z.object({ page: z.coerce.number().int().min(1).max(100000).optional(), limit: z.coerce.number().int().min(1).max(100).optional(), search: z.string().trim().max(150).optional() }).strict();
const account = z.object({ version: z.number().int().positive(), onboardingStatus: z.enum(['pending', 'configuring', 'pilot']).optional(), needs: z.string().trim().max(2000).nullable().optional(), nextReviewAt: z.coerce.date().nullable().optional() }).strict().refine((v) => Object.keys(v).length > 1, 'No hay cambios.');
const contact = z.object({ requestKey: z.uuid(), name: z.string().trim().min(2).max(120), position: z.string().trim().max(120).optional(), email: z.string().trim().email().max(190).optional(), phone: z.string().trim().max(30).regex(/^[+\d ()-]*$/).optional() }).strict();
router.use('/platform-crm', requireRole('platform_admin'));
router.use('/platform-crm', (req, res, next) => {
  const parsed = pagination.safeParse(req.query);
  if (!parsed.success) throw invalid('Revisa los filtros.');
  req.platformCrmQuery = parsed.data;
  next();
});
const institutionId = (req) => {
  const parsed = id.safeParse(req.params.institutionId);
  if (!parsed.success) throw invalid('Identificador inválido.');
  return parsed.data;
};
router.get('/platform-crm/institutions', async (req, res) => res.json(await crm.listInstitutions(req.platformCrmQuery)));
router.get('/platform-crm/institutions/:institutionId', async (req, res) => res.json({ data: await crm.detail(institutionId(req)) }));
router.post('/platform-crm/institutions/:institutionId/account', validateBody(z.object({}).strict()), async (req, res) => res.json({ data: await crm.initialize(req.user, institutionId(req)) }));
router.patch('/platform-crm/institutions/:institutionId/account', validateBody(account), async (req, res) => res.json({ data: await crm.updateAccount(req.user, institutionId(req), req.body) }));
router.get('/platform-crm/institutions/:institutionId/contacts', async (req, res) => res.json(await crm.listContacts(institutionId(req), req.platformCrmQuery)));
router.post('/platform-crm/institutions/:institutionId/contacts', validateBody(contact), async (req, res) => res.status(201).json({ data: await crm.addContact(req.user, institutionId(req), req.body) }));
export default router;
