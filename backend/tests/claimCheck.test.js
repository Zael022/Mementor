import test from 'node:test';
import assert from 'node:assert/strict';
import { checkClaim, numbersIn, verifyAnswer } from '../src/utils/claimCheck.js';
import { parseModelReply, parseStreamReply } from '../src/services/tutorService.js';

// M05: una cita auténtica no convierte en respaldada una afirmación que contradice su pasaje.
const S1 = { sourceId: 'S1', text: 'Dos más dos son cuatro.' };
const fraccion = { sourceId: 'S1', text: 'Una fracción representa partes iguales de una unidad. El denominador indica en cuántas partes se divide la unidad y nunca es cero.' };

test('reconoce números en cifras y en palabras', () => {
  assert.deepEqual([...numbersIn('Dos más dos son cuatro')].sort(), [2, 4]);
  assert.deepEqual([...numbersIn('El plazo es de 3 días; 1.000 colones o 4,5 puntos')].sort((a, b) => a - b), [3, 4.5, 1000]);
  // «un» y «una» funcionan como artículos.
  assert.equal(numbersIn('Una fracción tiene un numerador').size, 0);
});

test('rechaza «Dos más dos son nueve» aunque cite la fuente real', () => {
  assert.equal(checkClaim('Dos más dos son nueve [S1].', S1.text).ok, false);
  assert.equal(checkClaim('Dos más dos son cuatro [S1].', S1.text).ok, true);
  assert.equal(parseStreamReply('Dos más dos son nueve [S1].', [S1]).grounded, false);
  assert.equal(parseModelReply(JSON.stringify({ answer: 'Dos más dos son nueve.', citedSourceIds: ['S1'], grounded: true }), [S1]).grounded, false);
  assert.equal(parseStreamReply('Dos más dos son cuatro [S1].', [S1]).grounded, true);
});

test('rechaza una oración sin relación con el pasaje que cita', () => {
  const result = verifyAnswer('La fotosíntesis convierte luz solar en energía química dentro del cloroplasto [S1].', [fraccion]);
  assert.equal(result.ok, false);
  assert.equal(result.failures[0].reason, 'low_overlap');
});

test('acepta una explicación con sus propias palabras que conserva los términos de la fuente', () => {
  const answer = 'Una fracción muestra partes iguales de una unidad [S1]. El denominador dice en cuántas partes se divide la unidad [S1] y no puede ser cero [S1].';
  assert.equal(verifyAnswer(answer, [fraccion]).ok, true);
});

test('una fuente citada sin afirmaciones que verificar no se considera contradicha', () => {
  assert.equal(verifyAnswer('¿Quieres un ejemplo?', [fraccion]).ok, true);
  assert.equal(verifyAnswer('Algo', []).ok, false);
});
