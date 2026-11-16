import test from 'node:test';
import assert from 'node:assert/strict';
import { MASTERY, computeMastery, evidenceLabel, recommendationType } from '../src/utils/mastery.js';

// Comprueba la fórmula de dominio documentada.
test('sin respuestas el dominio es el valor neutral y no hay evidencia', () => {
  const result = computeMastery([]);
  assert.equal(result.score, 0.5);
  assert.equal(result.evidenceCount, 0);
  assert.equal(evidenceLabel(0), 'sin_evidencia');
});

test('aplica el suavizado (2*0.5 + aciertos) / (2 + respuestas)', () => {
  assert.equal(computeMastery([true, false]).score, 0.5);
  assert.equal(computeMastery([true, true, true, true]).score, 0.833);
  assert.equal(computeMastery([false, false, false]).score, 0.2);
});

test('solo considera las 20 respuestas más recientes', () => {
  const answers = [...Array(20).fill(true), ...Array(30).fill(false)];
  const result = computeMastery(answers);
  assert.equal(result.evidenceCount, MASTERY.recentAnswersMax);
  assert.equal(result.score, 0.955);
});

test('la etiqueta indica estimación inicial con menos de 3 evidencias', () => {
  assert.equal(evidenceLabel(2), 'estimacion_inicial');
  assert.equal(evidenceLabel(3), 'estimado');
});

test('la recomendación depende del dominio y de la evidencia', () => {
  assert.equal(recommendationType(0.4, 5), 'reinforce');
  assert.equal(recommendationType(0.7, 5), 'practice');
  assert.equal(recommendationType(0.9, 2), 'practice');
  assert.equal(recommendationType(0.9, 5), 'advance');
});
