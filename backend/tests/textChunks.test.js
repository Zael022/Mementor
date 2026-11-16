import test from 'node:test';
import assert from 'node:assert/strict';
import { locatePassageRange, splitSections, terms } from '../src/utils/textChunks.js';

test('los fragmentos conservan rangos exactos con espacios, CRLF y líneas vacías', () => {
  const text = `   # Reglamento\r\n\r\n${'La matrícula tiene un plazo de treinta días.\r\n\r\n\r\n'.repeat(55)}El código final es SQL-99.`;
  const sections = splitSections(text);
  const covered = new Uint8Array(text.length);
  for (const section of sections) {
    assert.equal(section.text, text.slice(section.start, section.end));
    assert.ok(section.text.length <= 1200);
    covered.fill(1, section.start, section.end);
  }
  for (let i = 0; i < text.length; i += 1) {
    if (/\S/.test(text[i])) assert.equal(covered[i], 1, `Carácter perdido en ${i}`);
  }
  assert.ok(sections.at(-1).text.includes('SQL-99.'));
});

test('fragmentar conserva puntuación y cadenas largas sin espacios', () => {
  const text = `!?${'x'.repeat(2500)}?!\n\n${'!'.repeat(2000)}`;
  const sections = splitSections(text);
  const covered = new Uint8Array(text.length);
  for (const section of sections) covered.fill(1, section.start, section.end);
  assert.ok([...text].every((char, index) => /\s/.test(char) || covered[index]));
  assert.ok(sections.slice(1).every((section, index) => section.start < sections[index].end));
});

test('el buscador reconoce siglas cortas y elimina las palabras vacías', () => {
  assert.deepEqual(terms('¿Qué es la IA y SQL?'), ['ia', 'sql']);
  assert.deepEqual(terms('de la en un y el'), []);
});

test('localizar un pasaje conserva su final al normalizar Unicode y saltos de línea', () => {
  const full = '📚 Introducción.\n\nEl plazo de matrícula\n\n\n es de treinta días.';
  const range = locatePassageRange(full, 'el plazo de matricula es de treinta dias.');
  assert.equal(full.slice(range.start, range.end), 'El plazo de matrícula\n\n\n es de treinta días.');
});

test('una coincidencia parcial con un final inventado se descarta', () => {
  const common = 'El reglamento define los requisitos del curso y los pasos de matrícula. '.repeat(4);
  assert.equal(locatePassageRange(`${common}El plazo es 30 días.`, `${common}El plazo es 900 días.`), null);
});

test('los números escritos con letras no cuentan como tema', () => {
  assert.deepEqual(terms('¿Cuánto es dos más dos?'), []);
  assert.deepEqual(terms('Las tres primeras partes y la mitad'), ['part']);
  assert.deepEqual(terms('el denominador nunca es cero'), ['denominador', 'nunca']);
});
