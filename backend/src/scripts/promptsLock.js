// Actualiza src/prompts/prompts.lock.json. Se niega si un texto cambió y su versión sigue igual: primero sube la versión.
import { readFile, writeFile } from 'node:fs/promises';
import { ALL_PROMPTS, fingerprint } from '../prompts/index.js';

const LOCK = new URL('../prompts/prompts.lock.json', import.meta.url);
const current = JSON.parse(await readFile(LOCK, 'utf8').catch(() => '{}'));
const next = {};
const errors = [];
for (const prompt of ALL_PROMPTS) {
  const hash = fingerprint(prompt);
  const previous = current[prompt.id];
  if (previous && previous.version === prompt.version && previous.sha256 !== hash) {
    errors.push(`${prompt.id}: el texto cambió y la versión sigue en ${prompt.version}. Sube la versión.`);
  }
  next[prompt.id] = { version: prompt.version, sha256: hash };
}
if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}
await writeFile(LOCK, `${JSON.stringify(next, null, 2)}\n`);
console.log(`prompts.lock.json actualizado (${ALL_PROMPTS.length} prompts).`);
