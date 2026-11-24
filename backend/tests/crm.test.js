import test, { before, after, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { CrmStageEvent, CrmProspect, CrmDraft, User, Enrollment, AgentRun, AuditLog } from '../src/models/index.js';
import { clock } from '../src/utils/clock.js';
import { setAiProviderForTests } from '../src/services/aiProvider.js';
import { calculateFunnel, attentionReasons } from '../src/services/crmMetricsService.js';
import { STAGES } from '../src/validators/crmSchemas.js';
import { closeDatabase, createPlatformAdmin, loginAs, prepareDatabase, setupCourse, setupInstitution, activate, request, app, PASSWORD } from './helpers.js';

const ctx = {}; const realNow = clock.now; const DAY = 86400000;
const config = () => ({ transiciones: Array.from({ length: 8 }, (_, i) => ({ ventanaDias: 7, metaPct: i === 2 ? 75 : null })), diasAlerta: 5, conservacionCerradasDias: 90, conservacionBorradoresDias: 30, politica: 'Las fechas y resultados se confirman por la administración. Sin becas ni cupos anunciados.', politicaVersion: 'v1', aprobacionConservacion: 'Acta de prueba aislada' });
async function cycle(name = 'Convocatoria aislada', courseId = ctx.course.courseId, session = ctx.org.admin) {
  const r = await session.post('/crm/convocatorias', { courseId, nombre: name, sede: 'Sede de prueba', inicio: new Date(clock.now() - 100 * DAY).toISOString(), fin: new Date(+clock.now() + 100 * DAY).toISOString(), configuracion: config() });
  assert.equal(r.status, 201, JSON.stringify(r.body)); return r.body.data;
}
let counter = 0;
async function prospect(cycleId = ctx.cycle.id, email, session = ctx.org.admin) {
  counter += 1;
  const r = await session.post('/crm/prospectos', { convocatoriaId: cycleId, nombre: `Persona aislada ${counter}`, correo: email || `crm.${counter}@prueba.test`, procedencia: 'Prueba aislada' });
  assert.equal(r.status, 201, JSON.stringify(r.body)); return r.body.data;
}
const detail = async (id, session = ctx.org.admin) => (await session.get(`/crm/solicitudes/${id}`)).body.data;
async function move(p, stage, activity) {
  const row = await detail(p.solicitudId);
  const r = await ctx.org.admin.patch(`/crm/prospectos/${p.prospectoId}/etapa`, { solicitudId: p.solicitudId, etapa: stage, versionEsperada: row.version, motivo: 'Resultado verificado en prueba aislada', ...(activity ? { actividad: activity } : {}) });
  assert.equal(r.status, 200, JSON.stringify(r.body)); return r.body.data;
}
async function progress(p, destination = 7) {
  for (let i = 1; i <= destination; i++) {
    const when = clock.now().toISOString();
    let activity;
    if (i === 2) activity = { tipo: 'campus', programada: when };
    if (i === 3) activity = { tipo: 'campus', efectiva: when, resultado: 'asistio', evidencia: 'Registro de asistencia temporal' };
    if (i === 4) activity = { tipo: 'tecnica', efectiva: when, resultado: 'aprobada', evidencia: 'Revisión manual temporal' };
    if (i === 5) activity = { tipo: 'entrevista', programada: when };
    if (i === 6) activity = { tipo: 'entrevista', efectiva: when, resultado: 'favorable', evidencia: 'Entrevista temporal realizada' };
    if (i === 7) activity = { tipo: 'prueba', programada: when };
    await move(p, STAGES[i], activity);
  }
}
const conversionInput = (row, mode = 'nueva', exceptional = false) => ({ versionEsperada: row.version, modo: mode, excepcional: exceptional, decisionConfirmada: true, motivo: 'Confirmación humana en prueba aislada', ...(!exceptional ? { actividad: { tipo: 'prueba', efectiva: clock.now().toISOString(), resultado: 'completada', evidencia: 'Semana de prueba verificada' } } : {}) });

before(async () => {
  await prepareDatabase(); await createPlatformAdmin('operador.crm@prueba.test'); ctx.platform = await loginAs('operador.crm@prueba.test');
  ctx.org = await setupInstitution(ctx.platform, 'CRM A'); ctx.other = await setupInstitution(ctx.platform, 'CRM B'); ctx.course = await setupCourse(ctx.org, 'CRM-A');
  const invited = await ctx.org.admin.post('/users', { email: 'auditor.crm@prueba.test', displayName: 'Auditoría temporal', role: 'auditor' }); await activate(invited.body.data.invitationToken); ctx.auditor = await loginAs('auditor.crm@prueba.test');
  ctx.cycle = await cycle();
});
afterEach(() => { clock.now = realNow; setAiProviderForTests(null); delete process.env.AGENT_DAILY_LIMIT_PER_USER; delete process.env.AGENT_DAILY_LIMIT_PER_INSTITUTION; });
after(async () => { clock.now = realNow; setAiProviderForTests(null); await closeDatabase(); });

test('las cinco rutas requieren sesión, permisos y correspondencia institucional', async () => {
  const p = await prospect();
  assert.equal((await request(app).get('/api/v1/crm/embudo')).status, 401);
  for (const session of [ctx.platform, ctx.org.student]) assert.equal((await session.get(`/crm/solicitudes/${p.solicitudId}`)).status, 403);
  assert.equal((await ctx.other.admin.get(`/crm/solicitudes/${p.solicitudId}`)).status, 404);
  assert.equal((await ctx.org.teacher.get(`/crm/solicitudes/${p.solicitudId}`)).status, 404);
  assert.equal((await ctx.auditor.get(`/crm/solicitudes/${p.solicitudId}`)).status, 403);
  assert.equal((await ctx.other.admin.patch(`/crm/prospectos/${p.prospectoId}/etapa`, { solicitudId: p.solicitudId, etapa: 'candidato', versionEsperada: 1, motivo: 'Revisión inicial' })).status, 404);
  assert.equal((await ctx.other.admin.post(`/crm/solicitudes/${p.solicitudId}/matricular`, conversionInput({ version: 1 }))).status, 404);
  assert.equal((await ctx.other.admin.post(`/crm/prospectos/${p.prospectoId}/mensaje`, { solicitudId: p.solicitudId, canal: 'correo', tono: 'formal', objetivo: 'Próximo contacto' })).status, 404);
  assert.equal((await ctx.other.admin.post(`/crm/prospectos/${p.prospectoId}/privacidad`, { accion: 'acceso', verificacionRef: 'Caso ajeno', verificadaEn: clock.now().toISOString(), motivo: 'Acceso solicitado' })).status, 404);
  assert.equal((await ctx.auditor.get(`/crm/embudo?convocatoriaId=${ctx.cycle.id}`)).status, 200);
  const trace = await ctx.auditor.get('/crm/trazabilidad'); assert.ok(trace.body.data.length); assert.equal(trace.body.data[0].reason, undefined);
});

test('varias convocatorias reutilizan ficha sin duplicar solicitud ni aceptar campos de control', async () => {
  const p = await prospect(); const second = await cycle('Segunda convocatoria');
  const r = await ctx.org.admin.post('/crm/solicitudes', { prospectoId: p.prospectoId, convocatoriaId: second.id }); assert.equal(r.status, 201);
  assert.equal((await ctx.org.admin.post('/crm/solicitudes', { prospectoId: p.prospectoId, convocatoriaId: second.id })).status, 409);
  await move(p, 'candidato'); assert.equal((await detail(r.body.data.solicitudId)).stage, 'prospecto');
  const first = await CrmProspect.findByPk(p.prospectoId);
  const conflict = await ctx.org.admin.post('/crm/prospectos', { convocatoriaId: second.id, nombre: 'Otra persona', correo: ` ${first.email.toUpperCase()} `, procedencia: 'Formulario' }); assert.equal(conflict.status, 409);
  assert.equal((await ctx.org.admin.post('/crm/prospectos', { convocatoriaId: ctx.cycle.id, nombre: 'Persona', correo: 'campo@prueba.test', procedencia: 'Formulario', institutionId: ctx.other.institutionId })).status, 422);
  const wrong = await prospect();
  assert.equal((await ctx.org.admin.patch(`/crm/prospectos/${wrong.prospectoId}/etapa`, { solicitudId: p.solicitudId, etapa: 'agenda_campus_day', versionEsperada: 2, motivo: 'No corresponde' })).status, 404);
});

test('las transiciones validan actividades, citas futuras, concurrencia, correcciones y etapa final', async () => {
  const p = await prospect(); const beforeEvents = await CrmStageEvent.count({ where: { applicationId: p.solicitudId } });
  const data = { solicitudId: p.solicitudId, etapa: 'candidato', versionEsperada: 1, motivo: 'Revisión inicial verificada' };
  const responses = await Promise.all([ctx.org.admin.patch(`/crm/prospectos/${p.prospectoId}/etapa`, data), ctx.org.admin.patch(`/crm/prospectos/${p.prospectoId}/etapa`, data)]);
  assert.deepEqual(responses.map((r) => r.status).sort(), [200, 409]); assert.equal(await CrmStageEvent.count({ where: { applicationId: p.solicitudId } }), beforeEvents + 1);
  assert.equal((await ctx.org.admin.patch(`/crm/prospectos/${p.prospectoId}/etapa`, { ...data, etapa: 'estudiante', versionEsperada: 2 })).status, 409);
  assert.equal((await ctx.org.admin.patch(`/crm/prospectos/${p.prospectoId}/etapa`, { ...data, etapa: 'agenda_campus_day', versionEsperada: 2 })).status, 422);
  await move(p, 'agenda_campus_day', { tipo: 'campus', programada: new Date(+clock.now() + DAY).toISOString() });
  const row = await detail(p.solicitudId);
  assert.equal((await ctx.org.admin.post(`/crm/solicitudes/${row.id}/actividades`, { versionEsperada: row.version, motivo: 'Ausencia que no ocurrió', actividad: { tipo: 'campus', efectiva: clock.now().toISOString(), resultado: 'no_asistio', evidencia: 'No es evidencia válida' } })).status, 422);
  await move(p, 'candidato');
  assert.ok((await detail(p.solicitudId)).events.some((e) => e.kind === 'correction'));
});

test('docente asignado solo registra actividades y seguimientos; una nota no reinicia el avance', async () => {
  const p = await prospect();
  await ctx.org.admin.patch(`/crm/solicitudes/${p.solicitudId}`, { versionEsperada: 1, responsableId: ctx.org.teacher.user.id, motivo: 'Entrevista asignada explícitamente' });
  const row = await detail(p.solicitudId); assert.equal((await ctx.org.teacher.get(`/crm/solicitudes/${row.id}`)).status, 200);
  const follow = await ctx.org.teacher.post(`/crm/solicitudes/${row.id}/seguimientos`, { versionEsperada: row.version, responsableId: ctx.org.teacher.user.id, vence: new Date(clock.now() - DAY).toISOString(), tipo: 'contacto', nota: 'Nota temporal' }); assert.equal(follow.status, 201);
  const after = await detail(row.id); assert.equal(after.lastStageChangedAt, row.lastStageChangedAt); assert.equal(after.lastContactAt, null);
  const attention = await ctx.org.teacher.get('/crm/atencion'); assert.ok(attention.body.data.find((r) => r.id === row.id).reasons.some((r) => r.code === 'followup'));
  assert.equal((await ctx.org.teacher.post(`/crm/solicitudes/${row.id}/matricular`, conversionInput(after))).status, 403);
  const done = await ctx.org.teacher.patch(`/crm/solicitudes/${row.id}/seguimientos/${follow.body.data.id}`, { versionEsperada: after.version, resultado: 'Contacto realizado' }); assert.equal(done.status, 200);
  assert.ok((await detail(row.id)).lastContactAt);
  assert.equal((await ctx.org.admin.patch(`/crm/solicitudes/${row.id}`, { versionEsperada: after.version + 1, responsableId: ctx.other.teacher.user.id, motivo: 'Asignación ajena prohibida' })).status, 404);
});

test('conversión nueva es atómica e idempotente; invitación no se reemite y se activa por el flujo existente', async () => {
  const p = await prospect(); await progress(p); const row = await detail(p.solicitudId); const input = conversionInput(row);
  const responses = await Promise.all([ctx.org.admin.post(`/crm/solicitudes/${row.id}/matricular`, input), ctx.org.admin.post(`/crm/solicitudes/${row.id}/matricular`, input)]);
  responses.forEach((r) => assert.equal(r.status, 200, JSON.stringify(r.body)));
  assert.equal(responses.filter((r) => r.body.data.invitacion).length, 1); assert.equal(new Set(responses.map((r) => r.body.data.matriculaId)).size, 1);
  const invitation = responses.find((r) => r.body.data.invitacion).body.data.invitacion;
  const account = await User.findByPk(invitation.user.id); assert.notEqual(account.invitationTokenHash, invitation.invitationToken); assert.equal(account.passwordHash, null);
  assert.equal((await detail(row.id)).account.status, 'invited'); assert.equal((await activate(invitation.invitationToken)).status, 200);
  assert.equal((await detail(row.id)).account.status, 'active'); assert.equal((await ctx.org.admin.post(`/crm/solicitudes/${row.id}/matricular`, input)).body.data.invitacion, undefined);
});

test('cuenta invitada, compatible, deshabilitada, rol ajeno y otra institución', async () => {
  const invited = await ctx.org.admin.post('/users', { email: 'invited.crm@prueba.test', displayName: 'Invitada compatible', role: 'student' });
  const p = await prospect(ctx.cycle.id, invited.body.data.user.email); await progress(p); const row = await detail(p.solicitudId);
  const result = await ctx.org.admin.post(`/crm/solicitudes/${row.id}/matricular`, conversionInput(row)); assert.equal(result.status, 200); assert.equal(result.body.data.activacionPendiente, true); assert.equal(result.body.data.invitacion, undefined);
  for (const [email, expected] of [[ctx.org.teacher.user.email, 'CONTACT_UNAVAILABLE'], [ctx.other.student.user.email, 'CONTACT_UNAVAILABLE']]) {
    const candidate = await prospect(ctx.cycle.id, email); await progress(candidate); const appRow = await detail(candidate.solicitudId);
    const failure = await ctx.org.admin.post(`/crm/solicitudes/${appRow.id}/matricular`, conversionInput(appRow)); assert.equal(failure.status, 409); assert.equal(failure.body.error.code, expected); assert.ok(!failure.body.error.message.includes(email));
  }
  const disabled = await ctx.org.admin.post('/users', { email: 'disabled.crm@prueba.test', displayName: 'Cuenta deshabilitada', role: 'student' }); await ctx.org.admin.patch(`/users/${disabled.body.data.user.id}`, { status: 'disabled' });
  const candidate = await prospect(ctx.cycle.id, disabled.body.data.user.email); await progress(candidate); const appRow = await detail(candidate.solicitudId);
  assert.equal((await ctx.org.admin.post(`/crm/solicitudes/${appRow.id}/matricular`, conversionInput(appRow))).body.error.code, 'ACCOUNT_DISABLED');
});

test('matrícula activa exige vinculación y matrícula retirada exige reintegro, sin contarlas como nuevas', async () => {
  const p = await prospect(ctx.cycle.id, ctx.org.student.user.email);
  const first = await ctx.org.admin.post(`/crm/solicitudes/${p.solicitudId}/matricular`, conversionInput({ version: 1 }, 'vincular', true)); assert.equal(first.status, 200); assert.equal(first.body.data.tipo, 'vinculada');
  const secondCycle = await cycle('Reintegro explícito'); const r = await ctx.org.admin.post('/crm/solicitudes', { prospectoId: p.prospectoId, convocatoriaId: secondCycle.id }); const second = { prospectoId: p.prospectoId, solicitudId: r.body.data.solicitudId }; await progress(second);
  await Enrollment.update({ status: 'withdrawn' }, { where: { id: first.body.data.matriculaId } });
  const row = await detail(second.solicitudId);
  assert.equal((await ctx.org.admin.post(`/crm/solicitudes/${row.id}/matricular`, conversionInput(row))).body.error.code, 'WITHDRAWN_ENROLLMENT');
  const reinstated = await ctx.org.admin.post(`/crm/solicitudes/${row.id}/matricular`, conversionInput(row, 'reintegrar')); assert.equal(reinstated.body.data.tipo, 'reintegrada'); assert.equal(reinstated.body.data.matriculaId, first.body.data.matriculaId);
  const report = await ctx.org.admin.get(`/crm/embudo?convocatoriaId=${ctx.cycle.id}`); const final = report.body.data.stages[8]; assert.ok(final.conversionKinds.vinculada >= 1);
});

test('un fallo intermedio revierte cuenta, matrícula y evento; un curso sin publicar bloquea', async () => {
  const p = await prospect(); await progress(p); const row = await detail(p.solicitudId); const count = await User.count(); const enrollments = await Enrollment.count();
  CrmStageEvent.addHook('beforeCreate', 'crm-rollback-test', (event) => { if (event.kind === 'enrollment') throw new Error('Falla aislada'); });
  try { assert.equal((await ctx.org.admin.post(`/crm/solicitudes/${row.id}/matricular`, conversionInput(row))).status, 500); } finally { CrmStageEvent.removeHook('beforeCreate', 'crm-rollback-test'); }
  assert.equal(await User.count(), count); assert.equal(await Enrollment.count(), enrollments); assert.equal((await detail(row.id)).stage, 'semana_prueba');
  await ctx.org.teacher.patch(`/courses/${ctx.course.courseId}`, { status: 'draft' });
  assert.equal((await ctx.org.admin.post(`/crm/solicitudes/${row.id}/matricular`, conversionInput(row))).status, 404);
  await ctx.org.teacher.patch(`/courses/${ctx.course.courseId}`, { status: 'published' });
});

test('IA recibe contexto sin identidad; salida inválida, falta de clave y fallas no guardan borradores', async () => {
  const p = await prospect(); const input = { solicitudId: p.solicitudId, canal: 'correo', tono: 'formal', objetivo: 'Explicar el siguiente paso' }; let payload;
  const guard = { provider: process.env.AI_PROVIDER, key: process.env.AI_API_KEY, model: process.env.AI_MODEL }; delete process.env.AI_API_KEY;
  assert.equal((await ctx.org.admin.post(`/crm/prospectos/${p.prospectoId}/mensaje`, input)).body.error.code, 'AI_NOT_CONFIGURED');
  if (guard.key !== undefined) process.env.AI_API_KEY = guard.key;
  setAiProviderForTests({ complete: async (data) => { payload = JSON.stringify(data); return { text: '{"texto":"Por favor revisa las condiciones autorizadas de la convocatoria.","faltantes":[]}', usage: { inputTokens: 12, outputTokens: 10 } }; } });
  const r = await ctx.org.admin.post(`/crm/prospectos/${p.prospectoId}/mensaje`, input); assert.equal(r.status, 201, JSON.stringify(r.body));
  const contact = await CrmProspect.findByPk(p.prospectoId); assert.ok(!payload.includes(contact.email)); assert.ok(!payload.includes(contact.name)); assert.equal(r.body.data.status, 'pending'); assert.ok(r.body.data.agentRunId);
  setAiProviderForTests({ complete: async () => ({ text: '{"texto":"x"}' }) }); assert.equal((await ctx.org.admin.post(`/crm/prospectos/${p.prospectoId}/mensaje`, input)).status, 502);
  const { AppError } = await import('../src/utils/AppError.js'); setAiProviderForTests({ complete: async () => { throw new AppError(503, 'AI_UNAVAILABLE', 'Proveedor temporalmente indisponible.'); } });
  assert.equal((await ctx.org.admin.post(`/crm/prospectos/${p.prospectoId}/mensaje`, input)).status, 503); assert.equal(await CrmDraft.count({ where: { applicationId: p.solicitudId } }), 1);
});

test('borrador manual, edición exacta, aprobación y cambios de contexto requieren nueva revisión', async () => {
  const p = await prospect(); const r = await ctx.org.admin.post(`/crm/solicitudes/${p.solicitudId}/borradores`, { canal: 'correo', tono: 'formal', objetivo: 'Explicar el próximo paso', texto: 'Revisa la convocatoria autorizada y confirma tu interés.' }); assert.equal(r.status, 201);
  const route = `/crm/solicitudes/${p.solicitudId}/borradores/${r.body.data.id}`;
  assert.equal((await ctx.org.admin.get(`${route}/copia`)).status, 409);
  const approved = await ctx.org.admin.post(`${route}/revision`, { versionEsperada: 1, accion: 'aprobar' }); assert.equal(approved.body.data.approvedVersion, 2);
  assert.equal((await ctx.org.admin.get(`${route}/copia`)).status, 200);
  const edited = await ctx.org.admin.patch(route, { versionEsperada: 2, texto: 'Consulta los requisitos confirmados de la convocatoria.', canal: 'correo' }); assert.equal(edited.body.data.status, 'pending'); assert.equal(edited.body.data.approverId, null);
  await move(p, 'candidato'); assert.equal((await ctx.org.admin.post(`${route}/revision`, { versionEsperada: 3, accion: 'aprobar' })).body.error.code, 'STALE_CONTEXT');
  await ctx.org.admin.post(`${route}/revision`, { versionEsperada: 3, accion: 'actualizar_contexto' }); assert.equal((await ctx.org.admin.post(`${route}/revision`, { versionEsperada: 4, accion: 'aprobar' })).status, 200);
});

test('cuotas simultáneas por persona e institución incluyen reservas y no duplican tutor', async () => {
  const p = await prospect(); process.env.AGENT_DAILY_LIMIT_PER_USER = '10000';
  const used = await AgentRun.count({ where: { institutionId: ctx.org.institutionId, agent: { [(await import('sequelize')).Op.ne]: 'tutor' }, status: { [(await import('sequelize')).Op.ne]: 'no_evidence' } } });
  process.env.AGENT_DAILY_LIMIT_PER_INSTITUTION = String(used + 1);
  let release; const held = new Promise((r) => { release = r; }); let calls = 0;
  setAiProviderForTests({ complete: async () => { calls++; await held; return { text: '{"texto":"Consulta las condiciones de esta convocatoria autorizada.","faltantes":[]}' }; } });
  const input = { solicitudId: p.solicitudId, canal: 'correo', tono: 'formal', objetivo: 'Explicar el próximo paso' };
  const first = ctx.org.admin.post(`/crm/prospectos/${p.prospectoId}/mensaje`, input).then((r) => r);
  while (!calls) await new Promise((r) => setTimeout(r, 10));
  const second = await ctx.org.admin.post(`/crm/prospectos/${p.prospectoId}/mensaje`, input); assert.equal(second.status, 429); release(); assert.equal((await first).status, 201);
  process.env.AGENT_DAILY_LIMIT_PER_INSTITUTION = '10000'; process.env.AGENT_DAILY_LIMIT_PER_USER = '1'; assert.equal((await ctx.org.admin.post(`/crm/prospectos/${p.prospectoId}/mensaje`, input)).status, 429);
});

test('consentimientos, corrección, acceso y supresión sin cuenta conservan evidencia mínima y eliminan residuos', async () => {
  const p = await prospect(); const route = `/crm/prospectos/${p.prospectoId}`;
  const consent = await ctx.org.admin.post(`${route}/consentimientos`, { finalidad: 'admisiones', documentoVersion: '1', evidencia: 'Referencia institucional temporal', origen: 'Formulario firmado', aceptadoEn: clock.now().toISOString() }); assert.equal(consent.status, 201);
  await ctx.org.admin.post(`/crm/solicitudes/${p.solicitudId}/borradores`, { canal: 'correo', tono: 'formal', objetivo: 'Contacto inicial autorizado', texto: 'Borrador manual para comprobar supresión.' });
  const requestBody = { accion: 'acceso', verificacionRef: 'Caso de identidad temporal', verificadaEn: clock.now().toISOString(), motivo: 'Solicitud de la persona verificada' };
  const exported = await ctx.org.admin.post(`${route}/privacidad`, requestBody); assert.equal(exported.body.data.data.drafts.length, 1);
  assert.equal((await ctx.org.admin.post(`${route}/privacidad`, { ...requestBody, accion: 'correccion', correccion: { nombre: 'Nombre corregido' } })).status, 200);
  assert.equal((await ctx.org.admin.post(`${route}/privacidad`, { ...requestBody, accion: 'supresion' })).status, 200);
  const row = await CrmProspect.findByPk(p.prospectoId); assert.equal(row.email, null); assert.equal(await CrmDraft.count({ where: { applicationId: p.solicitudId } }), 0);
  const audit = await AuditLog.findAll({ where: { resourceType: 'crm_prospect', resourceId: p.prospectoId } }); assert.ok(audit.length >= 3); assert.ok(!JSON.stringify(audit).includes('Referencia institucional temporal'));
});

test('cumplimiento enmascara el payload antes de llamar al proveedor', async () => {
  let data; setAiProviderForTests({ complete: async (payload) => { data = JSON.stringify(payload); return { text: '{"riskLevel":"medio","issues":[],"summary":"Revisar el contenido antes de publicar."}' }; } });
  const text = 'Contacto temporal: prueba.privacidad@prueba.test, teléfono 8888-7777 y cédula 1-1234-5678. No publicar.';
  assert.equal((await ctx.org.teacher.post('/agents/compliance_checker/run', { text })).status, 200);
  for (const original of ['prueba.privacidad@prueba.test', '8888-7777', '1-1234-5678']) assert.ok(!data.includes(original));
});

test('la configuración y las cohortes históricas no se reinterpretan al editar metas o procedencia', async () => {
  const anchor = new Date(realNow() - 30 * DAY); let now = anchor; clock.now = () => now;
  const c = await cycle('Versiones históricas'); const p = await prospect(c.id); now = new Date(+anchor + DAY); await move(p, 'candidato');
  const cfg = config(); cfg.transiciones[0].metaPct = 90;
  await ctx.org.admin.patch(`/crm/convocatorias/${c.id}`, { versionEsperada: 1, configuracion: cfg });
  const second = await prospect(c.id); assert.ok(second.solicitudId);
  now = realNow();
  const old = await ctx.org.admin.get(`/crm/embudo?convocatoriaId=${c.id}&configuracionVersion=1`); assert.equal(old.body.data.cohort.applications, 1); assert.equal(old.body.data.stages[0].targetPct, null);
  const newer = await ctx.org.admin.get(`/crm/embudo?convocatoriaId=${c.id}`); assert.equal(newer.body.data.configVersion, 2); assert.equal(newer.body.data.stages[0].targetPct, 90);
  const historic = await ctx.org.admin.get(`/crm/embudo?convocatoriaId=${c.id}&corte=${new Date(+anchor + DAY / 2).toISOString()}`); assert.equal(historic.body.data.stages[0].A, 0); assert.equal(historic.body.data.configVersion, 1);
  const wrongCampus = await ctx.org.admin.get(`/crm/embudo?convocatoriaId=${c.id}&sede=Otra`); assert.equal(wrongCampus.body.data.cohort.applications, 0);
  await ctx.org.admin.patch(`/crm/convocatorias/${c.id}`, { versionEsperada: 2, estado: 'closed' });
  const closed = await ctx.org.admin.get(`/crm/embudo?convocatoriaId=${c.id}`); assert.equal(closed.body.data.configVersion, 2); assert.equal(closed.body.data.cohort.applications, 1);
  const privacy = { accion: 'correccion', verificacionRef: 'Identidad verificada temporal', verificadaEn: now.toISOString(), motivo: 'Corrección solicitada', correccion: { procedencia: 'Origen corregido' } };
  await ctx.org.admin.post(`/crm/prospectos/${p.prospectoId}/privacidad`, privacy);
  const unchanged = await ctx.org.admin.get(`/crm/embudo?convocatoriaId=${c.id}&configuracionVersion=1&procedencia=Prueba%20aislada`); assert.equal(unchanged.body.data.cohort.applications, 1);
});

test('exportación propia y baja de cuenta incluyen y anonimizan los residuos vinculados del CRM', async () => {
  const p = await prospect(); await progress(p); const row = await detail(p.solicitudId);
  const converted = await ctx.org.admin.post(`/crm/solicitudes/${row.id}/matricular`, conversionInput(row)); const invitation = converted.body.data.invitacion; await activate(invitation.invitationToken);
  const account = await loginAs(invitation.user.email);
  const exported = await account.get('/me/data-export'); assert.equal(exported.status, 200, JSON.stringify(exported.body)); assert.equal(exported.body.data.admissions.length, 1); assert.equal(exported.body.data.admissions[0].applications[0].id, row.id);
  const deletion = await account.post('/me/deletion-request', { password: PASSWORD, confirm: true }); assert.equal(deletion.status, 202, JSON.stringify(deletion.body));
  assert.equal((await CrmProspect.findByPk(p.prospectoId)).email, null); assert.equal((await detail(row.id)).stage, 'estudiante');
});

test('retención usa el cierre, respeta excepciones y borra borradores sin guardar contactos indefinidamente', async () => {
  const anchor = new Date(realNow() - 100 * DAY); clock.now = () => anchor;
  const c = await cycle('Conservación temporal'); const p = await prospect(c.id); const keep = await prospect(c.id);
  await ctx.org.admin.patch(`/crm/solicitudes/${p.solicitudId}`, { versionEsperada: 1, estado: 'retirado', motivo: 'Cierre a solicitud de la persona' });
  await ctx.org.admin.patch(`/crm/solicitudes/${keep.solicitudId}`, { versionEsperada: 1, estado: 'rechazado', motivo: 'Decisión documentada', excepcionConservacion: 'Caso de revisión institucional todavía abierto' });
  clock.now = realNow;
  const { retainCrmData } = await import('../src/services/crmPrivacyService.js'); await retainCrmData();
  assert.equal((await CrmProspect.findByPk(p.prospectoId)).email, null); assert.ok((await CrmProspect.findByPk(keep.prospectoId)).email);
});

test('métricas numéricas del taller, denominadores maduros, retrocesos, fechas de corte y cero', () => {
  const cutoff = new Date('2026-11-20T12:00:00Z'); const cfg = config(); const apps = []; const events = [];
  for (let i = 1; i <= 120; i++) { apps.push({ id: i }); events.push({ id: i * 2, applicationId: i, fromStage: 'candidato', toStage: 'agenda_campus_day', kind: 'advance', effectiveAt: new Date(cutoff - 2 * DAY), recordedAt: new Date(cutoff - 2 * DAY) }); if (i <= 26) events.push({ id: i * 2 + 1, applicationId: i, fromStage: 'agenda_campus_day', toStage: 'asiste_campus_day', kind: 'advance', effectiveAt: new Date(cutoff - DAY), recordedAt: new Date(cutoff - DAY) }); }
  let metrics = calculateFunnel(apps, events, cutoff, cfg)[2]; assert.ok(Math.abs(metrics.observedPct - 21.6666666667) < 1e-7); assert.equal(metrics.expectedAtTarget, 90); assert.equal(metrics.expectedAtTarget - metrics.A, 64); assert.ok(Math.abs(metrics.descriptiveGapPoints - 53.333333333) < 1e-7); assert.equal(metrics.withoutAdvance, 94); assert.equal(metrics.maturePct, null); assert.equal(metrics.M, 0);
  metrics = calculateFunnel(apps, events, new Date(+cutoff + 8 * DAY), cfg)[2]; assert.equal(metrics.M, 120); assert.equal(metrics.AM, 26);
  events.push({ id: 999, applicationId: 1, fromStage: 'asiste_campus_day', toStage: 'agenda_campus_day', kind: 'correction', effectiveAt: cutoff, recordedAt: cutoff });
  events.push({ id: 1000, applicationId: 1, fromStage: 'agenda_campus_day', toStage: 'asiste_campus_day', kind: 'advance', effectiveAt: cutoff, recordedAt: new Date(+cutoff + DAY) });
  assert.equal(calculateFunnel(apps, events, cutoff, cfg)[2].A, 26);
  assert.equal(calculateFunnel([], [], cutoff, cfg)[0].observedPct, null); assert.equal(calculateFunnel([], [], cutoff, cfg)[8].A, null);
  const row = { status: 'lista_de_espera', reviewedAt: cutoff, lastStageChangedAt: new Date(cutoff - 30 * DAY), configJson: cfg, activityJson: { entrevista: { programada: new Date(+cutoff + DAY) } } };
  assert.deepEqual(attentionReasons(row, [], null, cutoff).map((r) => r.code), ['appointment']);
});

test('40 prospectos aislados demuestran las nueve etapas, cinco rutas y análisis reproducible', async () => {
  const anchor = new Date(realNow() - 60 * DAY); clock.now = () => anchor;
  const c = await cycle('Escenario reproducible 40'); const distribution = [6, 5, 5, 5, 5, 4, 4, 3, 3]; const created = [];
  for (let stage = 0; stage < 9; stage++) for (let n = 0; n < distribution[stage]; n++) {
    let now = new Date(+anchor + created.length * 3600000); clock.now = () => now;
    const p = await prospect(c.id); created.push(p);
    // El reloj avanza; ningún evento histórico se fabrica por SQL.
    now = new Date(+now + DAY); await progress(p, Math.min(stage, 7));
    if (stage === 8) { now = new Date(+now + 7 * DAY); const row = await detail(p.solicitudId); const r = await ctx.org.admin.post(`/crm/solicitudes/${row.id}/matricular`, conversionInput(row)); assert.equal(r.status, 200, JSON.stringify(r.body)); }
  }
  clock.now = realNow;
  setAiProviderForTests({ complete: async () => ({ text: '{"texto":"Consulta las condiciones autorizadas antes de continuar.","faltantes":[]}' }) });
  assert.equal((await ctx.org.admin.post(`/crm/prospectos/${created[0].prospectoId}/mensaje`, { solicitudId: created[0].solicitudId, canal: 'correo', tono: 'formal', objetivo: 'Explicar el siguiente paso' })).status, 201);
  assert.equal((await ctx.org.admin.get(`/crm/atencion?convocatoriaId=${c.id}`)).status, 200);
  const report = await ctx.org.admin.get(`/crm/embudo?convocatoriaId=${c.id}`); assert.equal(report.status, 200, JSON.stringify(report.body)); const stages = report.body.data.stages;
  assert.deepEqual(stages.map((s) => s.current), distribution); assert.equal(stages[2].N, 29); assert.equal(stages[2].A, 24); assert.equal(stages[2].M, 29); assert.equal(stages[2].AM, 24);
  assert.equal(stages[8].conversionKinds.nueva, 3); assert.ok(Math.abs(stages[2].maturePct - 24 / 29 * 100) < 1e-8);
  console.log('CRM40: 40 solicitudes; actuales 6/5/5/5/5/4/4/3/3; agenda→asiste 24/29=82,7586%; sin avance 5/29=17,2414%; meta 75%, brecha -7,7586 pp; nuevas matrículas 3. Datos efímeros de prueba.');
});
