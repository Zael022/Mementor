import * as knowledge from '../services/knowledgeService.js';
import * as tutorService from '../services/tutorService.js';
import * as usageService from '../services/usageService.js';
import { readId, readPagination } from '../utils/http.js';
import { AppError } from '../utils/AppError.js';

// --- Fuentes del tutor (docentes y administración) ---
export async function listSources(req, res) {
  res.json({ data: await knowledge.listCourseSources(req.user, readId(req.params.courseId)) });
}

export async function indexExisting(req, res) {
  res.json({ data: await knowledge.indexExisting(req.user, readId(req.params.courseId)) });
}

export async function retryVersion(req, res) {
  res.json({ data: await knowledge.retryVersion(req.user, readId(req.params.versionId)) });
}

export async function retireSource(req, res) {
  res.json({ data: await knowledge.retireByTeacher(req.user, readId(req.params.sourceId)) });
}

// --- Cita protegida ---
export async function getCitation(req, res) {
  res.json({ data: await tutorService.getCitation(req.user, readId(req.params.messageId), Number(req.params.position)) });
}

// --- Respuesta en streaming (SSE) ---
export async function streamTutor(req, res) {
  const controller = new AbortController();
  // Si la persona sale de la página o cierra la pestaña, se cancela la llamada al proveedor.
  res.on('close', () => { if (!res.writableFinished) controller.abort(); });
  let started = false;
  const open = () => {
    if (started) return;
    res.status(200).set({ 'content-type': 'text/event-stream; charset=utf-8', 'cache-control': 'no-cache, no-transform', 'x-accel-buffering': 'no' });
    res.flushHeaders();
    started = true;
  };
  const send = (event, data) => {
    open();
    if (!res.writableEnded) res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };
  // Señal de vida: algunos proxies cortan conexiones sin datos. Si la búsqueda tarda, el flujo se abre con el ping;
  // los errores rápidos (cuota, configuración) siguen llegando como JSON.
  const ping = setInterval(() => {
    open();
    if (!res.writableEnded) res.write(': ping\n\n');
  }, Math.max(10, Number(process.env.SSE_PING_MS || 15000)));
  res.on('close', () => clearInterval(ping));
  try {
    await tutorService.streamTutor(req.user, readId(req.params.threadId), req.body.question, { intent: req.body.intent, signal: controller.signal, onEvent: send });
    clearInterval(ping);
    res.end();
  } catch (error) {
    clearInterval(ping);
    if (controller.signal.aborted) return res.end();
    // Antes de abrir el flujo, el error viaja como JSON normal (por ejemplo 429 o 503).
    if (!started) throw error;
    const known = error instanceof AppError;
    send('error', { code: known ? error.code : 'INTERNAL_ERROR', message: known ? error.message : 'La respuesta se interrumpió.' });
    res.end();
  }
}

// --- Consumo y topes ---
export async function institutionUsage(req, res) {
  res.json({ data: await usageService.institutionUsage(req.user, { days: Number(req.query.days) || 30 }) });
}

export async function usageEvents(req, res) {
  res.json(await usageService.listUsageEvents(req.user, readPagination(req.query)));
}

export async function updateLimits(req, res) {
  res.json({ data: await usageService.updateInstitutionLimits(readId(req.params.institutionId), req.body) });
}
