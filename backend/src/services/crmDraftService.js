import { CrmDraft, CrmProspect, sequelize } from '../models/index.js';
import { applicationInScope, expectedVersion } from './crmAccessService.js';
import { admissionContext } from './crmContextService.js';
import { runAgent } from './agents/agentRunner.js';
import { auditCrm } from './crmService.js';
import { conflict, notFound } from '../utils/AppError.js';
import { clock } from '../utils/clock.js';

export async function createDraft(actor, id, input, manual = false) {
  const context = await admissionContext(actor, id, input.canal, input.objetivo, input.tono);
  const generated = manual ? null : await runAgent(actor, 'admissions_writer', { solicitudId: Number(id), canal: input.canal, objetivo: input.objetivo, tono: input.tono, contextoEsperado: context.hash }, { workflow: true });
  return sequelize.transaction(async (transaction) => {
    const application = await applicationInScope(actor, id, { admin: true, transaction, lock: true });
    const prospect = await CrmProspect.findByPk(application.prospectId, { transaction, lock: transaction.LOCK.UPDATE });
    if (prospect.anonymizedAt) throw conflict('ANONYMIZED', 'La ficha fue anonimizada mientras se generaba el borrador. No se guardó su contenido.');
    const row = await CrmDraft.create({ institutionId: actor.institutionId, applicationId: id, authorId: actor.id, agentRunId: generated?.runId ?? null, text: manual ? input.texto : generated.result.texto, channel: input.canal, recipient: context.recipient, contextHash: context.hash, contextJson: context.snapshot, source: manual ? 'manual' : 'ia' }, { transaction });
    await auditCrm(actor, 'draft_created', { id }, { draftId: row.id, source: row.source }, transaction);
    return row;
  });
}

export async function mutateDraft(actor, applicationId, draftId, input, edit = false) {
  return sequelize.transaction(async (transaction) => {
    await applicationInScope(actor, applicationId, { admin: true, transaction, lock: true });
    const row = await CrmDraft.findOne({ where: { id: draftId, applicationId, institutionId: actor.institutionId }, transaction, lock: transaction.LOCK.UPDATE });
    if (!row) throw notFound('Borrador no encontrado.'); expectedVersion(row, input.versionEsperada);
    const channel = edit ? input.canal : row.channel;
    const context = await admissionContext(actor, applicationId, channel, row.contextJson.objetivo, row.contextJson.tono);
    if (!edit && input.accion === 'aprobar' && (row.contextHash !== context.hash || row.recipient !== context.recipient)) throw conflict('STALE_CONTEXT', 'Cambió la ficha o la convocatoria. Actualiza el contexto y revisa el texto antes de aprobarlo.');
    const version = row.version + 1;
    const approving = !edit && input.accion === 'aprobar';
    await row.update({ version,
      ...(edit ? { text: input.texto, channel, recipient: context.recipient } : {}),
      ...(!edit && input.accion === 'actualizar_contexto' ? { contextHash: context.hash, contextJson: context.snapshot, recipient: context.recipient } : {}),
      status: approving ? 'approved' : input.accion === 'descartar' ? 'discarded' : 'pending',
      approverId: approving ? actor.id : null, approvedAt: approving ? clock.now() : null, approvedVersion: approving ? version : null,
    }, { transaction });
    await auditCrm(actor, approving ? 'draft_approved' : 'draft_updated', { id: applicationId }, { draftId: row.id, version, status: row.status }, transaction);
    return row;
  });
}

export async function useDraft(actor, applicationId, draftId) {
  await applicationInScope(actor, applicationId, { admin: true });
  const row = await CrmDraft.findOne({ where: { id: draftId, applicationId, institutionId: actor.institutionId } });
  if (!row) throw notFound('Borrador no encontrado.');
  const context = await admissionContext(actor, applicationId, row.channel, row.contextJson.objetivo, row.contextJson.tono);
  if (row.status !== 'approved' || row.approvedVersion !== row.version || row.contextHash !== context.hash) throw conflict('REVIEW_REQUIRED', 'Se requiere aprobar la versión actual con el contexto actualizado.');
  return { texto: row.text, canal: row.channel, destinatario: row.recipient, estado: 'Copiado no equivale a enviado' };
}
