// Repaso espaciado con FSRS-4.5 (Free Spaced Repetition Scheduler), aplicado por tema.
// Parámetros por defecto publicados por open-spaced-repetition; no están ajustados a esta plataforma (ver docs/adr/0005).
export const FSRS = {
  version: 'fsrs-4.5-topic',
  weights: [0.4872, 1.4003, 3.7145, 13.8206, 5.1618, 1.2298, 0.8975, 0.031, 1.6474, 0.1367, 1.0461, 2.1072, 0.0793, 0.3246, 1.587, 0.2272, 2.8755],
  desiredRetention: 0.9,
  maxIntervalDays: 365,
};

// Notas de repaso: 1 = otra vez, 2 = difícil, 3 = bien, 4 = fácil.
export const GRADES = { again: 1, hard: 2, good: 3, easy: 4 };

const DECAY = -0.5;
const FACTOR = 0.9 ** (1 / DECAY) - 1;
const DAY_MS = 24 * 3600 * 1000;
const w = FSRS.weights;
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const round3 = (value) => Math.round(value * 1000) / 1000;

// Probabilidad estimada de recordar el tema tras `elapsedDays` días.
export function retrievability(elapsedDays, stability) {
  return (1 + FACTOR * (Math.max(0, elapsedDays) / stability)) ** DECAY;
}

// Días hasta el próximo repaso para mantener la retención deseada.
export function intervalDays(stability) {
  const raw = (stability / FACTOR) * (FSRS.desiredRetention ** (1 / DECAY) - 1);
  return clamp(Math.round(raw), 1, FSRS.maxIntervalDays);
}

const initialStability = (grade) => Math.max(w[grade - 1], 0.1);
const initialDifficulty = (grade) => clamp(w[4] - (grade - 3) * w[5], 1, 10);

function nextDifficulty(difficulty, grade) {
  const moved = difficulty - w[6] * (grade - 3);
  // Reversión a la media para que la dificultad no se dispare.
  return clamp(w[7] * initialDifficulty(GRADES.good) + (1 - w[7]) * moved, 1, 10);
}

function recallStability(difficulty, stability, recall, grade) {
  const hardPenalty = grade === GRADES.hard ? w[15] : 1;
  const easyBonus = grade === GRADES.easy ? w[16] : 1;
  return stability * (1 + Math.exp(w[8]) * (11 - difficulty) * stability ** -w[9] * (Math.exp(w[10] * (1 - recall)) - 1) * hardPenalty * easyBonus);
}

function forgetStability(difficulty, stability, recall) {
  const value = w[11] * difficulty ** -w[12] * ((stability + 1) ** w[13] - 1) * Math.exp(w[14] * (1 - recall));
  return Math.min(value, stability);
}

// Calcula el nuevo estado del tema a partir del anterior (o null si es el primer repaso).
export function scheduleReview(previous, grade, now = new Date()) {
  if (![1, 2, 3, 4].includes(grade)) throw new Error('La nota de repaso debe ser 1, 2, 3 o 4.');
  let stability;
  let difficulty;
  let elapsedDays = 0;

  if (!previous) {
    stability = initialStability(grade);
    difficulty = initialDifficulty(grade);
  } else {
    elapsedDays = Math.max(0, (now.getTime() - new Date(previous.lastReviewedAt).getTime()) / DAY_MS);
    const recall = retrievability(elapsedDays, Number(previous.stability));
    const prevDifficulty = Number(previous.difficulty);
    difficulty = nextDifficulty(prevDifficulty, grade);
    stability = grade === GRADES.again
      ? forgetStability(prevDifficulty, Number(previous.stability), recall)
      : recallStability(prevDifficulty, Number(previous.stability), recall, grade);
  }

  stability = clamp(stability, 0.1, 36500);
  // «Otra vez» vuelve al día siguiente; el resto sigue el intervalo calculado.
  const scheduledDays = grade === GRADES.again ? 1 : intervalDays(stability);
  return {
    stability: round3(stability),
    difficulty: round3(difficulty),
    elapsedDays: round3(elapsedDays),
    scheduledDays,
    dueAt: new Date(now.getTime() + scheduledDays * DAY_MS),
    lastReviewedAt: now,
    reps: (previous?.reps ?? 0) + 1,
    lapses: (previous?.lapses ?? 0) + (previous && grade === GRADES.again ? 1 : 0),
    lastGrade: grade,
  };
}

// Convierte los aciertos de un tema en una evaluación en una nota de repaso objetiva.
export function gradeFromAnswers(correct, total) {
  if (total <= 0) return null;
  const ratio = correct / total;
  if (ratio < 0.5) return GRADES.again;
  if (ratio < 0.8) return GRADES.hard;
  if (ratio < 1) return GRADES.good;
  // «Fácil» exige al menos 3 preguntas: con una o dos no hay evidencia suficiente.
  return total >= 3 ? GRADES.easy : GRADES.good;
}
