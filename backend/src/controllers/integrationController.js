import { estimateCost } from '../services/costService.js';
import { latestRate } from '../services/external/exchangeRateService.js';
import { holidays } from '../services/external/holidayService.js';
import * as integrations from '../services/integrationService.js';
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

export async function reminders(req, res) {
  res.json({ data: await integrations.dailyReminders() });
}

export async function processDeletion(req, res) {
  res.json({ data: await integrations.processDeletionFromN8n(readId(req.params.requestId)) });
}

export async function deletionNotified(req, res) {
  res.json({ data: await integrations.markDeletionNotified(readId(req.params.requestId), req.body.status) });
}
