import * as preferenceService from '../services/preferenceService.js';
import * as reviewService from '../services/reviewService.js';
import * as studyPlanService from '../services/studyPlanService.js';
import { readId } from '../utils/http.js';

// --- Preferencias propias ---
export async function getPreferences(req, res) {
  res.json({ data: await preferenceService.getPreferences(req.user) });
}

export async function updatePreferences(req, res) {
  res.json({ data: await preferenceService.updatePreferences(req.user, req.body) });
}

// --- Repaso espaciado ---
export async function myReviews(req, res) {
  res.json({ data: await reviewService.listMyReviews(req.user, readId(req.query.courseId)) });
}

export async function selfReview(req, res) {
  res.json({ data: await reviewService.submitSelfReview(req.user, readId(req.params.topicId), req.body.grade) });
}

// --- Plan de estudio ---
export async function activePlan(req, res) {
  res.json({ data: await studyPlanService.getActivePlan(req.user, readId(req.params.courseId)) });
}

export async function createPlan(req, res) {
  res.status(201).json({ data: await studyPlanService.createPlan(req.user, readId(req.params.courseId), req.body) });
}

export async function updatePlanItem(req, res) {
  res.json({ data: await studyPlanService.updatePlanItem(req.user, readId(req.params.itemId), req.body) });
}

export async function archivePlan(req, res) {
  await studyPlanService.archivePlan(req.user, readId(req.params.planId));
  res.status(204).end();
}
