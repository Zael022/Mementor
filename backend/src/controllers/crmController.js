import * as crm from '../services/crmService.js';
import { convertApplication } from '../services/crmConversionService.js';
import { funnelReport, attentionList } from '../services/crmMetricsService.js';
import { createDraft, mutateDraft, useDraft } from '../services/crmDraftService.js';
import { recordConsent, revokeConsent, resolvePrivacy } from '../services/crmPrivacyService.js';
import { CrmStageEvent } from '../models/index.js';
import { crmScope } from '../services/crmAccessService.js';
import { readPagination, pageMeta } from '../utils/http.js';
import { notFound } from '../utils/AppError.js';

export const cycles = async (req, res) => res.json(await crm.listCycles(req.user, req.crmFilters));
export const history = async (req, res) => res.json(await crm.applicationHistory(req.user, req.params.id, req.crmFilters));
export const addCycle = async (req, res) => res.status(201).json({ data: await crm.createCycle(req.user, req.body) });
export const editCycle = async (req, res) => res.json({ data: await crm.updateCycle(req.user, req.params.id, req.body) });
export const prospects = async (req, res) => res.json(await crm.listProspects(req.user, req.crmFilters));
export const addProspect = async (req, res) => res.status(201).json({ data: await crm.createProspect(req.user, req.body) });
export const applications = async (req, res) => res.json(await crm.listApplications(req.user, req.crmFilters));
export const addApplication = async (req, res) => res.status(201).json({ data: await crm.createApplication(req.user, req.body) });
export const detail = async (req, res) => res.json({ data: await crm.applicationDetail(req.user, req.params.id) });
export const move = async (req, res) => res.json({ data: await crm.moveStage(req.user, req.params.id, req.body) });
export const update = async (req, res) => res.json({ data: await crm.updateApplication(req.user, req.params.id, req.body) });
export const activity = async (req, res) => res.status(201).json({ data: await crm.addActivity(req.user, req.params.id, req.body) });
export const followup = async (req, res) => res.status(201).json({ data: await crm.addFollowup(req.user, req.params.id, req.body) });
export const closeFollowup = async (req, res) => res.json({ data: await crm.finishFollowup(req.user, req.params.id, req.params.childId, req.body) });
export const convert = async (req, res) => res.json({ data: await convertApplication(req.user, req.params.id, req.body) });
export const funnel = async (req, res) => res.json({ data: await funnelReport(req.user, req.crmFilters) });
export const attention = async (req, res) => res.json(await attentionList(req.user, req.crmFilters));
export const generate = async (req, res) => {
  const row = await crm.applicationDetail(req.user, req.body.solicitudId);
  if (String(row.prospectId) !== req.params.id) throw notFound('La solicitud no corresponde al prospecto.');
  res.status(201).json({ data: await createDraft(req.user, req.body.solicitudId, req.body) });
};
export const manualDraft = async (req, res) => res.status(201).json({ data: await createDraft(req.user, req.params.id, req.body, true) });
export const editDraft = async (req, res) => res.json({ data: await mutateDraft(req.user, req.params.id, req.params.childId, req.body, true) });
export const reviewDraft = async (req, res) => res.json({ data: await mutateDraft(req.user, req.params.id, req.params.childId, req.body) });
export const copyDraft = async (req, res) => res.json({ data: await useDraft(req.user, req.params.id, req.params.childId) });
export const consent = async (req, res) => res.status(201).json({ data: await recordConsent(req.user, req.params.id, req.body) });
export const revoke = async (req, res) => res.json({ data: await revokeConsent(req.user, req.params.id, req.params.childId) });
export const privacy = async (req, res) => res.json({ data: await resolvePrivacy(req.user, req.params.id, req.body) });
export async function trace(req, res) {
  const p = readPagination(req.crmFilters);
  const { rows, count } = await CrmStageEvent.findAndCountAll({ where: crmScope(req.user, ['institution_admin', 'auditor']), attributes: ['id', 'applicationId', 'fromStage', 'toStage', 'kind', 'actorId', 'effectiveAt', 'recordedAt'], order: [['id', 'DESC']], limit: p.limit, offset: p.offset });
  res.json({ data: rows, meta: pageMeta(p, count) });
}
