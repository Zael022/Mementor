import 'dotenv/config';
import { diagnosticarIA } from '../services/aiDiagnostics.js';

// `npm run ia:verificar`: dice qué funciones de IA están listas y, si alguna no, qué falta. No muestra la clave.
const NOMBRES = { rapido: 'Modelo rápido (AI_MODEL_RAPIDO o AI_MODEL)', avanzado: 'Modelo avanzado (AI_MODEL_AVANZADO o AI_MODEL)' };

const { niveles, funciones, todo } = await diagnosticarIA();
console.log('\nVerificación de la IA de MENTOR\n');
for (const nivel of Object.values(niveles)) {
  console.log(`${nivel.funciona ? '✔' : '✖'} ${NOMBRES[nivel.nivel]}${nivel.modelo ? `: ${nivel.modelo}` : ''}`);
  if (nivel.motivo) console.log(`   → ${nivel.motivo}`);
  for (const aviso of nivel.avisos) console.log(`   ! ${aviso}`);
}
console.log('\nFunciones:');
for (const funcion of funciones) {
  console.log(`${funcion.funciona ? '✔' : '✖'} ${funcion.nombre}${funcion.funciona && funcion.requisito ? ` (${funcion.requisito})` : ''}`);
}
console.log(todo
  ? '\nTodo listo. Reinicia el backend si lo tenías abierto para que tome los cambios del .env.\n'
  : '\nCorrige lo marcado con ✖ en backend/.env, guarda y vuelve a correr `npm run ia:verificar`.\n');
process.exitCode = todo ? 0 : 1;
