import { Op } from 'sequelize';
import { CrmApplication, CrmStageEvent, CrmCycle, CrmFollowup, CrmProspect, User } from '../models/index.js';
import { clock } from '../utils/clock.js';
import { invalid } from '../utils/AppError.js';
import { readPagination, pageMeta } from '../utils/http.js';
import { crmScope, cycleInScope } from './crmAccessService.js';
import { STAGES, LABELS } from '../validators/crmSchemas.js';

const DAY = 86400000;
const percentage = (a, n) => n ? 100 * a / n : null;
const average = (xs) => xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
const median = (xs) => { const s = [...xs].sort((a, b) => a - b); return s.length ? (s[Math.floor((s.length - 1) / 2)] + s[Math.floor(s.length / 2)]) / 2 : null; };

// Primera llegada y transición directa; reingresos no multiplican la población.
export function calculateFunnel(applications, events, cutoff, config) {
  const cut = new Date(cutoff).getTime();
  const history = new Map(applications.map((row) => [String(row.id), []]));
  for (const e of events) if (+new Date(e.effectiveAt) <= cut && +new Date(e.recordedAt) <= cut) history.get(String(e.applicationId))?.push(e);
  const population = applications.map((row) => {
    const ordered = history.get(String(row.id)).sort((a, b) => +new Date(a.effectiveAt) - +new Date(b.effectiveAt) || Number(a.id) - Number(b.id));
    const reached = new Map(); const completed = new Map(); let stage = null; let status = 'activo'; let kind = null;
    for (const e of ordered) {
      stage = e.toStage;
      if (e.metadataJson?.status) status = e.metadataJson.status;
      if (['enrollment', 'exceptional_link'].includes(e.kind)) { status = 'matriculado'; kind = e.metadataJson?.kind; }
      if (!['initial', 'advance', 'enrollment', 'exceptional_link'].includes(e.kind)) continue;
      if (!reached.has(e.toStage)) reached.set(e.toStage, +new Date(e.effectiveAt));
      if (['advance', 'enrollment'].includes(e.kind) && STAGES.indexOf(e.toStage) === STAGES.indexOf(e.fromStage) + 1 && !completed.has(e.fromStage)) completed.set(e.fromStage, +new Date(e.effectiveAt));
    }
    return { row, reached, completed, stage, status, kind };
  });
  return STAGES.map((stage, index) => {
    const group = population.filter((p) => p.reached.has(stage));
    const current = population.filter((p) => p.stage === stage).length;
    if (index === 8) return { stage, label: LABELS[index], current, N: group.length, A: null, M: null, AM: null, observedPct: null, maturePct: null, nonConversionPct: null, reason: 'No hay transición siguiente', conversionKinds: Object.fromEntries(['nueva', 'vinculada', 'reintegrada'].map((k) => [k, group.filter((p) => p.kind === k).length])) };
    const settings = config.transiciones[index]; const window = settings.ventanaDias * DAY;
    const completed = group.filter((p) => p.completed.has(stage));
    const mature = group.filter((p) => p.reached.get(stage) + window <= cut);
    const onTime = mature.filter((p) => p.completed.has(stage) && p.completed.get(stage) <= p.reached.get(stage) + window);
    const pending = group.filter((p) => !p.completed.has(stage) && p.status === 'activo');
    const elapsed = completed.map((p) => (p.completed.get(stage) - p.reached.get(stage)) / DAY);
    const ages = pending.map((p) => (cut - p.reached.get(stage)) / DAY);
    const maturePct = percentage(onTime.length, mature.length); const observed = percentage(completed.length, group.length);
    return { stage, label: LABELS[index], current, N: group.length, A: completed.length, M: mature.length, AM: onTime.length,
      observedPct: observed, maturePct, nonConversionPct: mature.length ? 100 - maturePct : null,
      reason: group.length ? mature.length ? null : 'No hay cohorte madura' : 'Sin base de cálculo',
      openWindows: group.filter((p) => p.reached.get(stage) + window > cut).length,
      missingDates: 0, pendingInTime: pending.filter((p) => p.reached.get(stage) + window > cut).length,
      pendingOverdue: pending.filter((p) => p.reached.get(stage) + window <= cut).length,
      waiting: group.filter((p) => !p.completed.has(stage) && p.status === 'lista_de_espera').length,
      closures: Object.fromEntries(['retirado', 'rechazado'].map((s) => [s, group.filter((p) => p.status === s).length])),
      targetPct: settings.metaPct, windowDays: settings.ventanaDias,
      gapPoints: settings.metaPct !== null && maturePct !== null ? settings.metaPct - maturePct : null,
      descriptiveGapPoints: settings.metaPct !== null && observed !== null ? settings.metaPct - observed : null,
      expectedAtTarget: settings.metaPct !== null ? group.length * settings.metaPct / 100 : null,
      meanDays: average(elapsed), medianDays: median(elapsed), waitingMeanDays: average(ages),
      withoutAdvance: group.length - completed.length,
    };
  });
}

export async function funnelReport(actor, filters) {
  crmScope(actor, ['institution_admin', 'auditor']);
  if (!filters.convocatoriaId) throw invalid('Selecciona una convocatoria para delimitar la cohorte.');
  const cycle = await cycleInScope(actor, filters.convocatoriaId);
  const cutoff = filters.corte ? new Date(filters.corte) : clock.now();
  if (cutoff > clock.now()) throw invalid('La fecha de corte no puede ser futura.');
  const from = filters.desde ? new Date(filters.desde) : cycle.startsAt;
  const to = filters.hasta ? new Date(filters.hasta) : cutoff;
  if (to < from || to - from > 366 * DAY) throw invalid('La cohorte debe abarcar como máximo 366 días y tener fechas ordenadas.');
  const revisions = cycle.configHistory.filter((r) => +new Date(r.effectiveAt) <= +cutoff);
  const selected = filters.configuracionVersion ? revisions.find((r) => r.version === filters.configuracionVersion) : revisions.at(-1);
  if (!selected) throw invalid('No hay configuración vigente en la fecha de corte.');
  const where = { institutionId: actor.institutionId, cycleId: cycle.id, configVersion: selected.version, createdAt: { [Op.gte]: from, [Op.lte]: new Date(Math.min(+to, +cutoff)) }, ...(filters.procedencia ? { acquisitionOrigin: filters.procedencia } : {}), ...(filters.sede && filters.sede !== cycle.campus ? { id: -1 } : {}) };
  if (filters.etapa || filters.estado || filters.responsableId || filters.buscar) throw invalid('El reporte acepta cohorte, sede, procedencia, convocatoria, versión y corte; los filtros del estado actual pertenecen a la lista.');
  const applications = await CrmApplication.findAll({ where, limit: 10001 });
  if (applications.length > 10000) throw invalid('Acota la cohorte a menos de 10001 solicitudes.');
  const events = applications.length ? await CrmStageEvent.findAll({ where: { institutionId: actor.institutionId, applicationId: applications.map((r) => r.id), effectiveAt: { [Op.lte]: cutoff }, recordedAt: { [Op.lte]: cutoff } }, order: [['id', 'ASC']], limit: 100001 }) : [];
  if (events.length > 100000) throw invalid('Acota el historial del reporte.');
  const stages = calculateFunnel(applications, events, cutoff, selected.config);
  return { convocatoriaId: cycle.id, campus: cycle.campus, cutoff, generatedAt: clock.now(), cohort: { from, to, applications: applications.length, unit: 'solicitudes en una convocatoria; cada persona cuenta una vez aquí' }, configVersion: selected.version, availableVersions: revisions.map((r) => r.version), configuration: selected.config, stages, expenseData: null, expenseMessage: 'Sin datos de gasto', rankings: { count: [...stages.slice(0, 8)].sort((a, b) => b.withoutAdvance - a.withoutAdvance).map((r) => r.stage), percentage: [...stages.slice(0, 8)].filter((r) => r.nonConversionPct !== null).sort((a, b) => b.nonConversionPct - a.nonConversionPct).map((r) => r.stage), gap: [...stages.slice(0, 8)].filter((r) => r.gapPoints !== null).sort((a, b) => b.gapPoints - a.gapPoints).map((r) => r.stage) } };
}

export function attentionReasons(row, followups, account, now = clock.now()) {
  if (['retirado', 'rechazado'].includes(row.status)) return [];
  if (row.status === 'matriculado') return account?.status === 'invited' ? [{ code: 'activation', text: 'Activación de cuenta pendiente', priority: 2 }] : [];
  const reasons = [];
  if (!row.reviewedAt) reasons.push({ code: 'new', text: 'Solicitud nueva sin revisión', priority: 2 });
  const overdue = followups.filter((f) => f.status === 'pending' && f.dueAt < now);
  if (overdue.length) reasons.push({ code: 'followup', text: `${overdue.length} seguimiento(s) vencido(s)`, priority: 3 });
  const dates = Object.values(row.activityJson).map((a) => a.programada && !a.resultado ? new Date(a.programada) : null).filter(Boolean);
  const future = dates.some((d) => d > now);
  if (row.status === 'activo' && !future && now - row.lastStageChangedAt >= row.configJson.diasAlerta * DAY) reasons.push({ code: 'stalled', text: `Sin avance por al menos ${row.configJson.diasAlerta} días`, priority: 2 });
  if (dates.some((d) => d > now && d - now <= 2 * DAY)) reasons.push({ code: 'appointment', text: 'Cita próxima dentro de 48 horas', priority: 1 });
  return reasons;
}

export async function attentionList(actor, filters) {
  crmScope(actor, ['institution_admin', 'teacher']);
  const where = { institutionId: actor.institutionId, status: ['activo', 'lista_de_espera', 'matriculado'], ...(actor.role === 'teacher' ? { responsibleId: actor.id } : {}), ...(filters.convocatoriaId ? { cycleId: filters.convocatoriaId } : {}) };
  const rows = await CrmApplication.findAll({ where, include: [{ model: CrmProspect, as: 'prospect', attributes: ['id', 'name', 'userId'] }, { model: CrmCycle, as: 'cycle', attributes: ['name', 'campus'], ...(filters.sede ? { where: { campus: filters.sede } } : {}) }], limit: 5001 });
  if (rows.length > 5000) throw invalid('Selecciona una convocatoria para acotar la lista de atención.');
  const ids = rows.map((r) => r.id);
  const followups = ids.length ? await CrmFollowup.findAll({ where: { institutionId: actor.institutionId, applicationId: ids, status: 'pending' } }) : [];
  const users = rows.map((r) => r.prospect.userId).filter(Boolean);
  const accounts = users.length ? await User.findAll({ where: { id: users, institutionId: actor.institutionId }, attributes: ['id', 'status'] }) : [];
  const result = rows.map((row) => {
    const pending = followups.filter((f) => f.applicationId === row.id).sort((a, b) => a.dueAt - b.dueAt);
    return { ...row.toJSON(), nextContactAt: pending[0]?.dueAt ?? null, reasons: attentionReasons(row, pending, accounts.find((u) => u.id === row.prospect.userId)) };
  }).filter((r) => r.reasons.length).sort((a, b) => Math.max(...b.reasons.map((r) => r.priority)) - Math.max(...a.reasons.map((r) => r.priority)) || Number(a.id) - Number(b.id));
  const p = readPagination(filters);
  return { data: result.slice(p.offset, p.offset + p.limit), meta: pageMeta(p, result.length) };
}
