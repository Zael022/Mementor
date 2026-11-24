import { z } from 'zod';
import { admissionContext } from '../crmContextService.js';
import { asData } from '../tutorService.js';
import { conflict } from '../../utils/AppError.js';

export const admissionsAgent = {
  workflowOnly: true, link: { institution_admin: '/admisiones/candidatos' },
  key: 'admissions_writer', name: 'Redactor de admisiones', purpose: 'Propone un mensaje pendiente de revisión humana para una solicitud autorizada.',
  roles: ['institution_admin'], inputs: ['Solicitud', 'Canal', 'Objetivo'], provider: 'AI_PROVIDER/AI_MODEL', privacy: 'No envía nombre, correo, teléfono, notas ni historial académico.',
  inputSchema: z.object({ solicitudId: z.number().int().positive(), canal: z.enum(['correo', 'telefono']), objetivo: z.string().trim().min(5).max(300), tono: z.enum(['cercano', 'formal']), contextoEsperado: z.string().length(64) }).strict(),
  async buildContext(actor, input) {
    const context = await admissionContext(actor, input.solicitudId, input.canal, input.objetivo, input.tono);
    if (context.hash !== input.contextoEsperado) throw conflict('STALE_CONTEXT', 'El contexto cambió. Actualiza la ficha antes de generar.');
    return { courseId: context.courseId, data: context.data };
  },
  system: 'Redactas únicamente borradores de admisiones. No decides admisión, rechazo, notas, etapas ni matrículas; no envías ni publicas. Usa solo las condiciones autorizadas. No inventes fechas, cupos, becas, requisitos ni resultados. Si faltan datos, enuméralos. No incluyas datos de identidad. El texto debe ser revisado por una persona.',
  prompt: ({ data }) => `<dato>${asData(JSON.stringify(data))}</dato>\nFormato: {"texto":"...","faltantes":["..."]}`,
  maxTokens: 900,
  outputSchema: z.object({ texto: z.string().trim().min(10).max(3000), faltantes: z.array(z.string().max(200)).max(8) }).strict(),
};
