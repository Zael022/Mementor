import { z } from 'zod';
z.config(z.locales.es());

export const STAGES = ['prospecto', 'candidato', 'agenda_campus_day', 'asiste_campus_day', 'prueba_tecnica', 'entrevista', 'admitido', 'semana_prueba', 'estudiante'];
export const LABELS = ['Prospecto', 'Candidato', 'Agenda Campus Day', 'Asiste Campus Day', 'Prueba Técnica', 'Entrevista', 'Admitido', 'Semana de Prueba', 'Estudiante'];
export const id = z.coerce.number().int().positive().max(Number.MAX_SAFE_INTEGER);
const instant = z.string().datetime({ offset: true });
const reason = z.string().trim().min(5).max(500);
const email = z.string().trim().toLowerCase().email().max(190);
const version = { versionEsperada: z.number().int().positive() };
const transition = z.object({ ventanaDias: z.number().int().min(1).max(365), metaPct: z.number().min(0).max(100).nullable() }).strict();
export const configSchema = z.object({
  transiciones: z.array(transition).length(8), diasAlerta: z.number().int().min(1).max(365),
  conservacionCerradasDias: z.number().int().min(1).max(3650), conservacionBorradoresDias: z.number().int().min(1).max(3650),
  politica: z.string().trim().min(10).max(4000), politicaVersion: z.string().trim().min(1).max(40), aprobacionConservacion: z.string().trim().min(5).max(200),
}).strict();
export const cycleSchema = z.object({ courseId: id, nombre: z.string().trim().min(3).max(180), sede: z.string().trim().min(2).max(120), inicio: instant, fin: instant, configuracion: configSchema }).strict().refine((v) => v.fin > v.inicio, { message: 'El cierre debe ser posterior al inicio.' });
export const cycleUpdateSchema = z.object({ ...version, nombre: z.string().trim().min(3).max(180).optional(), estado: z.enum(['open', 'closed']).optional(), configuracion: configSchema.optional() }).strict();
export const prospectSchema = z.object({ convocatoriaId: id, nombre: z.string().trim().min(2).max(120), correo: email, telefono: z.string().trim().max(30).optional(), procedencia: z.string().trim().min(2).max(80), utm: z.object({ source: z.string().max(80).optional(), medium: z.string().max(80).optional(), campaign: z.string().max(80).optional() }).strict().optional() }).strict();
export const applicationSchema = z.object({ convocatoriaId: id, prospectoId: id }).strict();
export const activitySchema = z.object({ tipo: z.enum(['campus', 'tecnica', 'entrevista', 'prueba']), programada: instant.optional(), efectiva: instant.optional(), resultado: z.enum(['asistio', 'no_asistio', 'aprobada', 'no_aprobada', 'favorable', 'desfavorable', 'completada']).optional(), evidencia: z.string().trim().min(5).max(300).optional() }).strict();
export const stageSchema = z.object({ ...version, solicitudId: id, etapa: z.enum(STAGES), motivo: reason, actividad: activitySchema.optional(), fechaEfectiva: instant.optional() }).strict();
export const updateApplicationSchema = z.object({ ...version, responsableId: id.nullable().optional(), estado: z.enum(['activo', 'lista_de_espera', 'retirado', 'rechazado']).optional(), revisada: z.literal(true).optional(), excepcionConservacion: z.string().trim().min(10).max(300).nullable().optional(), motivo: reason }).strict();
export const recordActivitySchema = z.object({ ...version, actividad: activitySchema, motivo: reason }).strict();
export const followupSchema = z.object({ ...version, responsableId: id, vence: instant, tipo: z.enum(['contacto', 'campus', 'entrevista', 'prueba']), nota: z.string().trim().max(500).optional() }).strict();
export const finishFollowupSchema = z.object({ ...version, resultado: z.string().trim().min(3).max(300) }).strict();
export const convertSchema = z.object({ ...version, modo: z.enum(['nueva', 'vincular', 'reintegrar']), motivo: reason, decisionConfirmada: z.literal(true), actividad: activitySchema.optional(), excepcional: z.boolean().default(false) }).strict();
export const messageSchema = z.object({ solicitudId: id, canal: z.enum(['correo', 'telefono']), tono: z.enum(['cercano', 'formal']).default('cercano'), objetivo: z.string().trim().min(5).max(300) }).strict();
export const manualDraftSchema = messageSchema.omit({ solicitudId: true }).extend({ texto: z.string().trim().min(10).max(3000) }).strict();
export const editDraftSchema = z.object({ ...version, texto: z.string().trim().min(10).max(3000), canal: z.enum(['correo', 'telefono']) }).strict();
export const reviewDraftSchema = z.object({ ...version, accion: z.enum(['aprobar', 'descartar', 'actualizar_contexto']) }).strict();
export const consentSchema = z.object({ finalidad: z.enum(['admisiones', 'promociones']), documentoVersion: z.string().trim().min(1).max(40), evidencia: z.string().trim().min(5).max(200), origen: z.string().trim().min(3).max(80), aceptadoEn: instant }).strict();
export const correctionSchema = z.object({ nombre: z.string().trim().min(2).max(120).optional(), correo: email.optional(), telefono: z.string().trim().max(30).optional(), procedencia: z.string().trim().min(2).max(80).optional() }).strict();
export const privacySchema = z.object({ accion: z.enum(['acceso', 'correccion', 'supresion']), verificacionRef: z.string().trim().min(5).max(200), verificadaEn: instant, motivo: z.string().trim().min(5).max(300), correccion: correctionSchema.optional() }).strict();
export const filterSchema = z.object({ convocatoriaId: id.optional(), etapa: z.enum(STAGES).optional(), estado: z.enum(['activo', 'lista_de_espera', 'retirado', 'rechazado', 'matriculado']).optional(), responsableId: id.optional(), sede: z.string().max(120).optional(), procedencia: z.string().max(80).optional(), buscar: z.string().trim().max(100).optional(), desde: instant.optional(), hasta: instant.optional(), corte: instant.optional(), configuracionVersion: id.optional(), page: id.optional(), limit: id.max(100).optional() }).strict();
