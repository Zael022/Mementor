import * as assessmentService from '../services/assessmentService.js';
import * as masteryService from '../services/masteryService.js';
import * as tutorService from '../services/tutorService.js';
import { getCourseAnalytics } from '../services/analyticsService.js';
import { readId } from '../utils/http.js';

// --- Evaluaciones ---
export async function createAssessment(req, res) {
  res.status(201).json({ data: await assessmentService.createAssessment(req.user, readId(req.params.courseId), req.body) });
}

export async function listAssessments(req, res) {
  res.json({ data: await assessmentService.listAssessments(req.user, readId(req.params.courseId)) });
}

export async function getAssessment(req, res) {
  res.json({ data: await assessmentService.getAssessment(req.user, readId(req.params.assessmentId)) });
}

export async function addQuestion(req, res) {
  res.status(201).json({ data: await assessmentService.addQuestion(req.user, readId(req.params.assessmentId), req.body) });
}

export async function deleteQuestion(req, res) {
  await assessmentService.deleteQuestion(req.user, readId(req.params.questionId));
  res.status(204).end();
}

export async function publishAssessment(req, res) {
  res.json({ data: await assessmentService.changeStatus(req.user, readId(req.params.assessmentId), 'published') });
}

export async function closeAssessment(req, res) {
  res.json({ data: await assessmentService.changeStatus(req.user, readId(req.params.assessmentId), 'closed') });
}

// --- Intentos ---
export async function startAttempt(req, res) {
  res.status(201).json({ data: await assessmentService.startAttempt(req.user, readId(req.params.assessmentId)) });
}

export async function submitAttempt(req, res) {
  res.json({ data: await assessmentService.submitAttempt(req.user, readId(req.params.attemptId), req.body.answers) });
}

export async function attemptResult(req, res) {
  res.json({ data: await assessmentService.getAttemptResult(req.user, readId(req.params.attemptId)) });
}

// --- Progreso del estudiante ---
export async function myAttempts(req, res) {
  res.json({ data: await assessmentService.listMyAttempts(req.user, readId(req.query.courseId)) });
}

export async function myMastery(req, res) {
  res.json({ data: await masteryService.getMyMastery(req.user, readId(req.query.courseId)) });
}

export async function myRecommendations(req, res) {
  res.json({ data: await masteryService.getMyRecommendations(req.user, readId(req.query.courseId)) });
}

// --- Analítica docente ---
export async function courseAnalytics(req, res) {
  res.json({ data: await getCourseAnalytics(req.user, readId(req.params.courseId)) });
}

// --- Tutor IA ---
export function tutorStatus(req, res) {
  res.json({ data: tutorService.tutorStatus() });
}

export async function createThread(req, res) {
  res.status(201).json({ data: await tutorService.createThread(req.user, readId(req.params.courseId), req.body) });
}

export async function listThreads(req, res) {
  res.json({ data: await tutorService.listThreads(req.user, readId(req.params.courseId)) });
}

export async function listMessages(req, res) {
  res.json({ data: await tutorService.listMessages(req.user, readId(req.params.threadId)) });
}

export async function askTutor(req, res) {
  res.status(201).json({ data: await tutorService.askTutor(req.user, readId(req.params.threadId), req.body.question, { intent: req.body.intent }) });
}
