import { randomBytes, randomInt } from 'node:crypto';
import { Op } from 'sequelize';
import {
  Assessment, AssessmentAttempt, MemoryGame, Module, Question, QuestionOption, Topic, sequelize,
} from '../models/index.js';
import { conflict, forbidden, invalid, notFound } from '../utils/AppError.js';
import { clock } from '../utils/clock.js';
import { getCourseAccess } from './accessService.js';

// Parejas: práctica sin nota, sin bono y sin racha (ADR 0010).
// Fuente segura: solo preguntas cuya clave ya ve el estudiante en su pantalla de resultados
// (evaluación cerrada o intentos agotados, con al menos un intento enviado; la misma regla de assessmentService).
export const DEFAULT_PAIRS = 6;
export const MAX_PAIRS = 8;
export const MIN_PAIRS = 3;
const MAX_TEXT = 600;

// Compara textos sin mayúsculas, tildes ni espacios de más.
const normalize = (text) => String(text).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
const clip = (text) => {
  const clean = String(text).replace(/\s+/g, ' ').trim();
  return clean.length > MAX_TEXT ? `${clean.slice(0, MAX_TEXT - 1)}…` : clean;
};
// Identificador opaco de carta: no dice su posición ni con qué carta va.
const cardId = () => randomBytes(9).toString('base64url');

// Mezcla con un generador criptográfico (Fisher-Yates).
function shuffle(list) {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = randomInt(i + 1);
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

// Evaluaciones del curso cuya clave ya puede ver este estudiante.
async function assessmentsWithVisibleKey(studentId, courseId, transaction) {
  const assessments = await Assessment.findAll({
    where: { courseId, status: { [Op.in]: ['published', 'closed'] } },
    attributes: ['id', 'status', 'maxAttempts'],
    transaction,
  });
  if (!assessments.length) return [];
  const usedRows = await AssessmentAttempt.findAll({
    where: { assessmentId: assessments.map((row) => row.id), studentId, status: 'submitted' },
    attributes: ['assessmentId', [sequelize.fn('COUNT', sequelize.col('id')), 'used']],
    group: ['assessmentId'],
    raw: true,
    transaction,
  });
  const used = new Map(usedRows.map((row) => [Number(row.assessmentId), Number(row.used)]));
  return assessments
    .filter((row) => {
      const attempts = used.get(row.id) || 0;
      return attempts > 0 && (row.status === 'closed' || attempts >= row.maxAttempts);
    })
    .map((row) => row.id);
}

// Preguntas aptas por módulo: una sola opción correcta y sin enunciados ni respuestas repetidas.
async function eligiblePairs(studentId, courseId, { moduleId, transaction } = {}) {
  const visible = await assessmentsWithVisibleKey(studentId, courseId, transaction);
  if (!visible.length) return new Map();
  const questions = await Question.findAll({
    where: { assessmentId: visible },
    attributes: ['id', 'stem', 'topicId'],
    include: [
      { model: QuestionOption, as: 'options', attributes: ['id', 'body', 'isCorrect'] },
      { model: Topic, as: 'topic', attributes: ['id', 'moduleId'], where: { courseId, ...(moduleId ? { moduleId } : {}) } },
    ],
    order: [['assessmentId', 'ASC'], ['position', 'ASC'], ['id', 'ASC']],
    transaction,
  });

  const byModule = new Map();
  for (const question of questions) {
    const correct = question.options.filter((option) => option.isCorrect);
    if (correct.length !== 1) continue;
    const module = Number(question.topic.moduleId);
    const entry = byModule.get(module) || { stems: new Set(), answers: new Set(), pairs: [] };
    const stem = normalize(question.stem);
    const answer = normalize(correct[0].body);
    // Dos «Verdadero» harían dos cartas idénticas: se conserva solo la primera pregunta con esa respuesta.
    if (!stem || !answer || stem === answer || entry.stems.has(stem) || entry.answers.has(answer) || entry.stems.has(answer) || entry.answers.has(stem)) continue;
    entry.stems.add(stem);
    entry.answers.add(answer);
    entry.pairs.push({ questionId: question.id, question: clip(question.stem), answer: clip(correct[0].body) });
    byModule.set(module, entry);
  }
  return new Map([...byModule].map(([module, entry]) => [module, entry.pairs]));
}

// Cuántas parejas puede tener el tablero de cada módulo (0 si no alcanza el mínimo).
export async function practiceAvailability(user, courseId) {
  if (user.role !== 'student') return new Map();
  const pairs = await eligiblePairs(user.id, courseId);
  return new Map([...pairs].map(([module, list]) => [module, list.length >= MIN_PAIRS ? Math.min(list.length, MAX_PAIRS) : 0]));
}

const elapsedSeconds = (game) => Math.max(0, Math.round(((game.finishedAt || clock.now()) - game.startedAt) / 1000));

// Lo que ve el cliente: cartas boca abajo con su posición; solo las ya emparejadas muestran su texto.
function gameDto(game, module) {
  const matched = new Set(game.board.matched);
  return {
    id: game.id,
    courseId: game.courseId,
    moduleId: game.moduleId,
    moduleTitle: module?.title ?? null,
    status: game.status,
    pairCount: game.pairCount,
    matchedPairs: game.matchedPairs,
    attempts: game.attempts,
    elapsedSeconds: elapsedSeconds(game),
    startedAt: game.startedAt,
    finishedAt: game.finishedAt,
    cards: game.board.cards.map((card, index) => (matched.has(card.id)
      ? { id: card.id, position: index + 1, matched: true, kind: card.kind, text: card.text }
      : { id: card.id, position: index + 1, matched: false })),
  };
}

// Carga una partida solo para su dueño, siempre que siga con acceso al curso.
async function loadGame(user, gameId, { transaction, lock = false } = {}) {
  if (user.role !== 'student') throw forbidden('Parejas es una práctica para estudiantes.');
  const game = gameId ? await MemoryGame.findByPk(gameId, { transaction, ...(lock ? { lock: transaction.LOCK.UPDATE } : {}) }) : null;
  if (!game || game.studentId !== user.id || game.institutionId !== user.institutionId) throw notFound('Partida no encontrada.');
  await getCourseAccess(user, game.courseId, { transaction });
  return game;
}

// Busca una carta del tablero; una carta de otra partida, curso o institución no existe aquí.
function findCard(game, id) {
  const card = game.board.cards.find((item) => item.id === id);
  if (!card) throw invalid('Esa carta no es de este tablero.');
  return card;
}

// Empieza un tablero nuevo del módulo con las preguntas aptas del estudiante.
export async function startGame(user, moduleId, { pairs = DEFAULT_PAIRS } = {}) {
  if (user.role !== 'student') throw forbidden('Parejas es una práctica para estudiantes.');
  const module = moduleId ? await Module.findByPk(moduleId) : null;
  if (!module) throw notFound('Módulo no encontrado.');
  const { course } = await getCourseAccess(user, module.courseId);
  const available = (await eligiblePairs(user.id, course.id, { moduleId: module.id })).get(Number(module.id)) || [];
  if (available.length < MIN_PAIRS) throw conflict('NOT_ENOUGH_QUESTIONS', 'Este módulo aún no tiene preguntas de práctica.');

  const chosen = shuffle(available).slice(0, Math.min(pairs, MAX_PAIRS, available.length));
  const cards = shuffle(chosen.flatMap((pair, index) => [
    { id: cardId(), kind: 'question', text: pair.question, pair: index, questionId: pair.questionId },
    { id: cardId(), kind: 'answer', text: pair.answer, pair: index, questionId: pair.questionId },
  ]));

  const game = await sequelize.transaction(async (transaction) => {
    // Un tablero abandonado del mismo módulo se reemplaza: solo hay una partida abierta a la vez.
    await MemoryGame.destroy({ where: { studentId: user.id, moduleId: module.id, status: 'in_progress' }, transaction });
    return MemoryGame.create({
      institutionId: user.institutionId,
      courseId: course.id,
      moduleId: module.id,
      studentId: user.id,
      pairCount: chosen.length,
      board: { cards, matched: [] },
      startedAt: clock.now(),
    }, { transaction });
  });
  return gameDto(game, module);
}

export async function getGame(user, gameId) {
  const game = await loadGame(user, gameId);
  return gameDto(game, await Module.findByPk(game.moduleId, { attributes: ['id', 'title'] }));
}

// Voltea una carta: el servidor entrega su texto, nunca con qué carta va.
export async function revealCard(user, gameId, { cardId: id }) {
  const game = await loadGame(user, gameId);
  if (game.status !== 'in_progress') throw conflict('GAME_FINISHED', 'Esta partida ya terminó.');
  const card = findCard(game, id);
  return { id: card.id, position: game.board.cards.indexOf(card) + 1, kind: card.kind, text: card.text };
}

// Compara dos cartas. Cada comparación cuenta como un intento; la partida termina con la última pareja.
export async function matchCards(user, gameId, { cardIds }) {
  return sequelize.transaction(async (transaction) => {
    const game = await loadGame(user, gameId, { transaction, lock: true });
    if (game.status !== 'in_progress') throw conflict('GAME_FINISHED', 'Esta partida ya terminó.');
    const [first, second] = cardIds.map((id) => findCard(game, id));
    const matched = new Set(game.board.matched);
    if (matched.has(first.id) || matched.has(second.id)) throw conflict('ALREADY_MATCHED', 'Esa carta ya forma parte de una pareja.');

    const isMatch = first.pair === second.pair;
    const board = { ...game.board, matched: isMatch ? [...game.board.matched, first.id, second.id] : game.board.matched };
    const matchedPairs = game.matchedPairs + (isMatch ? 1 : 0);
    const finished = matchedPairs === game.pairCount;
    await game.update({
      board,
      attempts: game.attempts + 1,
      matchedPairs,
      ...(finished ? { status: 'finished', finishedAt: clock.now() } : {}),
    }, { transaction });

    const shown = (card) => ({ id: card.id, position: game.board.cards.indexOf(card) + 1, kind: card.kind, text: card.text });
    return {
      match: isMatch,
      cards: [shown(first), shown(second)],
      matchedPairs: game.matchedPairs,
      pairCount: game.pairCount,
      attempts: game.attempts,
      finished,
      elapsedSeconds: elapsedSeconds(game),
    };
  });
}
