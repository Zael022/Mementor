import { estimateCost } from '../services/costService.js';
import { latestRate } from '../services/external/exchangeRateService.js';
import { holidays } from '../services/external/holidayService.js';
import * as integrations from '../services/integrationService.js';
import { invalid } from '../utils/AppError.js';
import { readId } from '../utils/http.js';

// --- APIs externas para la interfaz ---
export async function exchangeRate(req, res) {
  res.json({ data: await latestRate() });
}

export async function publicHolidays(req, res) {
  res.json({ data: await holidays(req.query.year || new Date().getFullYear()) });
}

export async function costEstimate(req, res) {
  res.json({ data: await estimateCost(req.user, { days: req.query.days }) });
}

// --- Endpoints para los workflows de n8n ---
export async function receiveRate(req, res) {
  res.status(201).json({ data: await integrations.receiveExchangeRate(req.body) });
}

// Una página de recordatorios; n8n pide la siguiente con `after = meta.nextCursor` hasta que llegue null.
export async function reminders(req, res) {
  const after = req.query.after === undefined ? 0 : Number(req.query.after);
  const limit = req.query.limit === undefined ? 200 : Number(req.query.limit);
  if (!Number.isInteger(after) || after < 0 || !Number.isInteger(limit) || limit < 1 || limit > integrations.REMINDER_PAGE_MAX) {
    throw invalid(`Usa after ≥ 0 y limit entre 1 y ${integrations.REMINDER_PAGE_MAX}.`);
  }
  const page = await integrations.dailyReminders({ after, limit });
  res.json({ data: page.reminders, meta: { day: page.day, scanned: page.scanned, nextCursor: page.nextCursor } });
}

// n8n registra qué recordatorios se enviaron para no repetirlos en un reintento.
export async function reminderDeliveries(req, res) {
  res.json({ data: await integrations.recordReminderDeliveries(req.body) });
}

export async function processDeletion(req, res) {
  res.json({ data: await integrations.processDeletionFromN8n(readId(req.params.requestId)) });
}

export async function deletionNotified(req, res) {
  res.json({ data: await integrations.markDeletionNotified(readId(req.params.requestId), req.body.status) });
}
