// Parámetros del algoritmo de dominio (versión documentada en docs/08).
export const MASTERY = {
  version: 'baseline-1',
  prior: 0.5,
  priorWeight: 2,
  recentAnswersMax: 20,
  minEvidence: 3,
  reinforceBelow: 0.6,
  advanceAtOrAbove: 0.85,
};

// Calcula el dominio suavizado a partir de respuestas recientes (true/false).
export function computeMastery(recentAnswers) {
  const answers = recentAnswers.slice(0, MASTERY.recentAnswersMax);
  const correct = answers.filter(Boolean).length;
  const score = (MASTERY.priorWeight * MASTERY.prior + correct) / (MASTERY.priorWeight + answers.length);
  return { score: Math.round(score * 1000) / 1000, evidenceCount: answers.length, correctCount: correct };
}

// Describe qué tan confiable es la estimación.
export function evidenceLabel(evidenceCount) {
  if (evidenceCount === 0) return 'sin_evidencia';
  if (evidenceCount < MASTERY.minEvidence) return 'estimacion_inicial';
  return 'estimado';
}

// Decide el tipo de recomendación según el dominio y la evidencia.
export function recommendationType(score, evidenceCount) {
  if (score < MASTERY.reinforceBelow) return 'reinforce';
  if (score >= MASTERY.advanceAtOrAbove && evidenceCount >= MASTERY.minEvidence) return 'advance';
  return 'practice';
}
