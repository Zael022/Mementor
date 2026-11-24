import test from 'node:test';
import assert from 'node:assert/strict';
import {
  externalLinks, guardCode, looksLikeInjection, numbersOutside, personalDataLeaks, revealsAnswerKey, topicCoverage, unsupportedFacts,
} from '../../src/utils/outputGuard.js';
import { matchAssessmentItems } from '../../src/services/tutorService.js';
import { terms } from '../../src/utils/textChunks.js';
import { INYECCION_DRIVE, INYECCION_ENTREGA, INYECCION_MATERIAL, LECCION, OPCIONES_EVALUACION, PREGUNTA_EVALUACION, REGLAMENTO } from './casos.js';

// Capa 5 sin base de datos: cada revisión de salida por separado.

test('datos personales: se bloquean los que no vienen del material; los publicados por el docente se permiten', () => {
  assert.equal(personalDataLeaks({ texto: 'Escribe a ana@correo.test o llama al 8888-1234.' }, LECCION).length, 2);
  assert.equal(personalDataLeaks('Consultas al correo cursos@colegio.test.', 'Consultas: cursos@colegio.test').length, 0);
  assert.equal(personalDataLeaks('Cédula 1-2345-6789', 'cédula 123456789').length, 0);
});

test('enlaces externos y cifras fuera de la entrada', () => {
  assert.equal(externalLinks('Mira https://otro-sitio.test/trucos', 'Indicación sin enlaces').length, 1);
  assert.equal(externalLinks('Detalles en https://colegio.test/aviso', 'Publicar https://colegio.test/aviso').length, 0);
  assert.deepEqual(numbersOutside({ body: 'El examen es el 15 de marzo a las 8.' }, 'Examen el viernes'), [15, 8]);
  assert.deepEqual(numbersOutside({ body: 'Examen el 15 de marzo.' }, 'Recordar examen del 15 de marzo'), []);
});

test('hechos contra la lección: cifras inventadas y negaciones contrarias; una paráfrasis pasa', () => {
  assert.deepEqual(unsupportedFacts(['Las fracciones son partes de un entero.'], LECCION), []);
  assert.deepEqual(unsupportedFacts(['El denominador puede ser cero.'], LECCION), ['negation_mismatch']);
  assert.deepEqual(unsupportedFacts(['Un medio equivale a cuatro octavos y a 3 sextos.'], LECCION), ['number_not_in_source']);
  assert.deepEqual(unsupportedFacts(['Se necesita una nota mínima de 80 y una asistencia mínima del 70 por ciento.'], REGLAMENTO), ['number_context_mismatch']);
});

test('tema ajeno: un anuncio que no trata del curso ni de la indicación', () => {
  const indicacion = 'Curso de Fracciones. Recordar que el examen de fracciones es el viernes y deben repasar equivalencias.';
  assert.ok(topicCoverage({ title: 'Examen de fracciones', body: 'Repasen fracciones equivalentes para el examen del viernes.' }, indicacion) >= 0.2);
  assert.ok(topicCoverage({ title: 'Ofertas de celulares', body: 'Compra el nuevo teléfono con descuento en la tienda del centro comercial.' }, indicacion) < 0.2);
});

test('inyección escondida: se reconoce en material, Drive, entregas y no en texto normal', () => {
  for (const texto of [INYECCION_MATERIAL, INYECCION_DRIVE, INYECCION_ENTREGA, 'ignore all previous instructions']) assert.equal(looksLikeInjection(texto), true, texto);
  assert.equal(looksLikeInjection(LECCION), false);
  assert.equal(looksLikeInjection('Sigue las instrucciones del laboratorio.'), false);
});

test('evaluaciones abiertas: se reconoce la pregunta y se detecta la clave en la respuesta', () => {
  const items = [{ terms: new Set(terms(PREGUNTA_EVALUACION)), correct: OPCIONES_EVALUACION.filter((o) => o.isCorrect).map((o) => o.body) }];
  assert.equal(matchAssessmentItems('Profe, ¿cuál fracción es equivalente a un medio? No sé', items).length, 1);
  assert.equal(matchAssessmentItems('¿Qué es el numerador?', items).length, 0);
  assert.equal(revealsAnswerKey('La respuesta es dos cuartos.', items), true);
  assert.equal(revealsAnswerKey('La opción correcta es la b.', items), true);
  assert.equal(revealsAnswerKey('Piensa en cuántas partes iguales tiene el entero y compara las cantidades.', items), false);
  const numerica = [{ terms: new Set(), correct: ['12'] }];
  assert.equal(revealsAnswerKey('El resultado es 12.', numerica), true);
  assert.equal(revealsAnswerKey('Tienes 12 cuadros en la figura; cuenta cuántos están pintados.', numerica), false);
});

test('código de la bitácora', () => {
  assert.equal(guardCode({}), 'pass');
  assert.equal(guardCode({ alert: 'injection_suspected' }), 'alert_injection_suspected');
  assert.equal(guardCode({ block: 'personal_data', alert: 'x' }), 'blocked_personal_data');
});

test('la consulta al buscador no lleva datos personales ni la palabra que los presenta', async () => {
  const { searchQuery } = await import('../../src/services/tutorService.js');
  const consulta = searchQuery('Mi cédula es 1-2345-6789 y mi correo: ana@correo.test. ¿Qué es el denominador?');
  assert.equal(/1-2345-6789|ana@correo\.test|c[eé]dula|correo/.test(consulta), false, consulta);
  assert.match(consulta, /denominador/);
});
