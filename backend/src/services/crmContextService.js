import { createHash } from 'node:crypto';
import { CrmCycle, CrmProspect, Course } from '../models/index.js';
import { applicationInScope } from './crmAccessService.js';
import { conflict } from '../utils/AppError.js';
import { redactPersonalData } from '../utils/personalData.js';

export async function admissionContext(actor, applicationId, channel, objective = '', tone = 'cercano') {
  const row = await applicationInScope(actor, applicationId, { admin: true });
  const [cycle, prospect] = await Promise.all([CrmCycle.findByPk(row.cycleId), CrmProspect.findByPk(row.prospectId)]);
  if (prospect.anonymizedAt) throw conflict('ANONYMIZED', 'La ficha fue anonimizada.');
  const course = await Course.findByPk(cycle.courseId);
  return buildAdmissionContext(row, cycle, prospect, course, channel, objective, tone);
}

export function buildAdmissionContext(row, cycle, prospect, course, channel, objective = '', tone = 'cercano') {
  const recipient = channel === 'correo' ? prospect.email : prospect.phone;
  if (!recipient) throw conflict('NO_RECIPIENT', 'No hay contacto disponible para ese canal.');
  const data = {
    etapa: row.stage, estado: row.status, objetivo: objective, tono: tone, canal: channel,
    convocatoria: cycle.name, sede: cycle.campus, curso: course.title,
    inicio: cycle.startsAt, cierre: cycle.endsAt, politica: cycle.configJson.politica, politicaVersion: cycle.configJson.politicaVersion,
    fechas: Object.fromEntries(Object.entries(row.activityJson).map(([k, v]) => [k, { programada: v.programada ?? 'No registrada', efectiva: v.efectiva ?? 'No registrada', resultado: v.resultado ?? 'No registrado' }])),
  };
  // El hash incluye destinatario y versiones; el proveedor recibe solo data enmascarada.
  const snapshot = { ...data, applicationVersion: row.version, cycleVersion: cycle.version, recipient };
  const hash = createHash('sha256').update(JSON.stringify(snapshot)).digest('hex');
  return { row, courseId: course.id, recipient, hash, snapshot, data: JSON.parse(redactPersonalData(JSON.stringify(data))) };
}
