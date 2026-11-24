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

// Auditoría de producción H-01: una cita auténtica con cifras intercambiadas o con el sentido invertido.
const reglamento = [{ sourceId: 'S1', text: 'Para aprobar el curso se necesita una nota mínima de 70 y una asistencia mínima del 80 por ciento.' }];

test('acepta la regla tal como la dice la fuente y una paráfrasis con el número antes del sustantivo', () => {
  assert.equal(verifyAnswer('Para aprobar el curso se necesita una nota mínima de 70 y una asistencia mínima del 80 por ciento. [S1]', reglamento).ok, true);
  assert.equal(verifyAnswer('Para aprobar necesitas 70 de nota mínima y 80 por ciento de asistencia mínima [S1].', reglamento).ok, true);
});

test('rechaza cifras intercambiadas aunque todas estén en la fuente', () => {
  const result = verifyAnswer('Para aprobar el curso se necesita una nota mínima de 80 y una asistencia mínima del 70 por ciento. [S1]', reglamento);
  assert.equal(result.ok, false);
  assert.equal(result.failures[0].reason, 'number_context_mismatch');
});

test('rechaza una negación de lo que afirma la fuente, y al revés', () => {
  const negada = verifyAnswer('Para aprobar el curso no se necesita una nota mínima de 70 ni una asistencia mínima del 80 por ciento. [S1]', reglamento);
  assert.equal(negada.ok, false);
  assert.equal(negada.failures[0].reason, 'negation_mismatch');
  assert.equal(verifyAnswer('Para aprobar el curso se necesita una nota mínima de 99 y una asistencia mínima del 80 por ciento. [S1]', reglamento).ok, false);

  const entregas = [{ sourceId: 'S1', text: 'No se permite entregar tareas tarde después de la fecha límite.' }];
  assert.equal(verifyAnswer('Se permite entregar tareas tarde después de la fecha límite [S1].', entregas).ok, false);
  assert.equal(verifyAnswer('No puedes entregar tareas tarde después de la fecha límite [S1].', entregas).ok, true);
});

test('una negación que la fuente comparte, o sobre algo que la respuesta no afirma, no se rechaza', () => {
  // La fuente dice «nunca es cero»; omitir esa parte no la contradice.
  assert.equal(verifyAnswer('El denominador indica en cuántas partes se divide la unidad [S1].', [fraccion]).ok, true);
  assert.equal(verifyAnswer('El denominador de una fracción nunca vale cero [S1].', [fraccion]).ok, true);
});

test('una negación de otra parte del pasaje no contradice una afirmación sobre el mismo objeto', () => {
  const leccion = [{ sourceId: 'S1', text: 'El denominador nunca puede ser cero porque no se puede dividir un entero en cero partes.' }];
  assert.equal(verifyAnswer('Las fracciones son partes de un entero [S1].', leccion).ok, true);
});

test('una afirmación corta que contradice la fuente se rechaza; una pregunta no', () => {
  const leccion = [{ sourceId: 'S1', text: 'El denominador nunca puede ser cero porque no se puede dividir un entero en cero partes.' }];
  assert.equal(verifyAnswer('El denominador puede ser cero [S1].', leccion).ok, false);
  assert.equal(verifyAnswer('¿Puede el denominador ser cero? [S1] No, nunca puede ser cero [S1].', leccion).ok, true);
});
