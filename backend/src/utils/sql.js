import { Op } from 'sequelize';
import { sequelize, isPostgres } from '../config/database.js';

// Ayudas para escribir SQL una sola vez y que funcione en MySQL (local) y PostgreSQL (Supabase).

// PostgreSQL pasa a minúsculas los nombres sin comillas: «AS passingScore» llegaría como «passingscore».
// Aquí se ponen comillas dobles a los alias en camelCase. Se saltan los textos entre comillas simples
// y los parámetros «:nombre». Las columnas del esquema van en snake_case, así que no se tocan.
const CAMEL_O_TEXTO = /'(?:[^']|'')*'|(?<![:"\w])([a-z][a-z0-9]*[A-Z][A-Za-z0-9]*)\b/g;
export function portableSql(texto) {
  if (!isPostgres) return texto;
  return texto.replace(CAMEL_O_TEXTO, (encontrado, alias) => (alias ? `"${alias}"` : encontrado));
}

// Ejecuta una consulta escrita a mano adaptándola al motor activo.
export const runSql = (texto, opciones) => sequelize.query(portableSql(texto), opciones);

// Momento actual desplazado: «hace N días» o «dentro de N segundos». El parámetro va por replacements.
const UNIDADES = { DAY: 'day', HOUR: 'hour', SECOND: 'second', MICROSECOND: 'microsecond' };
export function nowPlus(parametro, unidad) {
  if (!UNIDADES[unidad] || !/^:\w+$|^-?\d+$/.test(parametro)) throw new Error('Intervalo no válido');
  return isPostgres
    ? `(CURRENT_TIMESTAMP(3) + (${parametro} * INTERVAL '1 ${UNIDADES[unidad]}'))`
    : `DATE_ADD(CURRENT_TIMESTAMP(3), INTERVAL ${parametro} ${unidad})`;
}
export function nowMinus(parametro, unidad) {
  if (!UNIDADES[unidad] || !/^:\w+$|^\d+$/.test(parametro)) throw new Error('Intervalo no válido');
  return isPostgres
    ? `(CURRENT_TIMESTAMP(3) - (${parametro} * INTERVAL '1 ${UNIDADES[unidad]}'))`
    : `DATE_SUB(CURRENT_TIMESTAMP(3), INTERVAL ${parametro} ${unidad})`;
}

// Año y mes («2026-11») de una columna de fecha.
export const yearMonth = (columna) => (isPostgres ? `TO_CHAR(${columna}, 'YYYY-MM')` : `DATE_FORMAT(${columna}, '%Y-%m')`);

// Filas tocadas por un UPDATE o DELETE: MySQL lo informa en affectedRows y PostgreSQL en rowCount.
export function affectedRows(respuesta) {
  const [resultado, metadatos] = Array.isArray(respuesta) ? respuesta : [respuesta];
  if (typeof metadatos === 'number') return metadatos;
  return resultado?.affectedRows ?? metadatos?.rowCount ?? metadatos?.affectedRows ?? 0;
}

// Búsqueda por texto sin distinguir mayúsculas: MySQL ya lo hace con su intercalación; PostgreSQL usa ILIKE.
export const likeOp = isPostgres ? Op.iLike : Op.like;
