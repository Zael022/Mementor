import * as quizService from '../services/quickQuizService.js';
import * as streakService from '../services/streakService.js';
import * as gradeService from '../services/gradeService.js';
import * as classWorkService from '../services/classWorkService.js';
import * as memoryGameService from '../services/memoryGameService.js';
import { readId } from '../utils/http.js';

// --- Quizzes rápidos (docente) ---
export async function createQuiz(req, res) {
  res.status(201).json({ data: await quizService.createQuiz(req.user, readId(req.params.courseId), req.body) });
}

export async function listQuizzes(req, res) {
  res.json({ data: await quizService.listQuizzes(req.user, readId(req.params.courseId)) });
}

export async function getQuiz(req, res) {
  res.json({ data: await quizService.getQuizForEdit(req.user, readId(req.params.quizId)) });
}

export async function updateQuiz(req, res) {
  res.json({ data: await quizService.updateQuiz(req.user, readId(req.params.quizId), req.body) });
}

export async function deleteQuiz(req, res) {
  await quizService.deleteQuiz(req.user, readId(req.params.quizId));
  res.status(204).end();
}

export async function addQuestion(req, res) {
  res.status(201).json({ data: await quizService.addQuestion(req.user, readId(req.params.quizId), req.body) });
}

export async function deleteQuestion(req, res) {
  await quizService.deleteQuestion(req.user, readId(req.params.questionId));
  res.status(204).end();
}

export async function publishQuiz(req, res) {
  res.json({ data: await quizService.changeStatus(req.user, readId(req.params.quizId), 'published') });
}

export async function archiveQuiz(req, res) {
  res.json({ data: await quizService.changeStatus(req.user, readId(req.params.quizId), 'archived') });
}

// --- Partidas (estudiante) ---
export async function startPlay(req, res) {
  res.status(201).json({ data: await quizService.startPlay(req.user, readId(req.params.quizId)) });
}

export async function nextQuestion(req, res) {
  res.json({ data: await quizService.nextQuestion(req.user, readId(req.params.playId)) });
}

export async function answerQuestion(req, res) {
  res.json({ data: await quizService.answerQuestion(req.user, readId(req.params.playId), req.body) });
}

export async function playResult(req, res) {
  res.json({ data: await quizService.getPlayResult(req.user, readId(req.params.playId)) });
}

// --- Práctica diaria y racha ---
export async function todayPractice(req, res) {
  res.json({ data: await streakService.getTodayPractice(req.user, readId(req.params.courseId)) });
}

export async function answerDaily(req, res) {
  res.json({ data: await streakService.answerDaily(req.user, readId(req.params.courseId), req.body) });
}

// --- Nota final ---
export async function myGrade(req, res) {
  res.json({ data: await gradeService.getMyGrade(req.user, readId(req.params.courseId)) });
}

export async function courseGrades(req, res) {
  res.json({ data: await gradeService.getCourseGrades(req.user, readId(req.params.courseId)) });
}

export async function savePolicy(req, res) {
  res.json({ data: await gradeService.savePolicy(req.user, readId(req.params.courseId), req.body) });
}

// --- Trabajo en clase ---
export async function createClassWork(req, res) {
  res.status(201).json({ data: await classWorkService.createItem(req.user, readId(req.params.courseId), req.body) });
}

export async function listClassWork(req, res) {
  res.json({ data: await classWorkService.listItems(req.user, readId(req.params.courseId)) });
}

export async function deleteClassWork(req, res) {
  await classWorkService.deleteItem(req.user, readId(req.params.itemId));
  res.status(204).end();
}

export async function saveClassWorkGrades(req, res) {
  res.json({ data: await classWorkService.saveGrades(req.user, readId(req.params.itemId), req.body.grades) });
}

// --- Parejas (práctica del módulo, sin nota ni bono) ---
export async function startMemoryGame(req, res) {
  res.status(201).json({ data: await memoryGameService.startGame(req.user, readId(req.params.moduleId), req.body) });
}

export async function getMemoryGame(req, res) {
  res.json({ data: await memoryGameService.getGame(req.user, readId(req.params.gameId)) });
}

export async function revealMemoryCard(req, res) {
  res.json({ data: await memoryGameService.revealCard(req.user, readId(req.params.gameId), req.body) });
}

export async function matchMemoryCards(req, res) {
  res.json({ data: await memoryGameService.matchCards(req.user, readId(req.params.gameId), req.body) });
}
