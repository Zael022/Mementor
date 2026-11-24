import { readFile, writeFile } from 'node:fs/promises';
import { sequelize } from '../config/database.js';

// Solo inspecciona el esquema de una base aislada migrada, nunca registros personales.
if (process.env.NODE_ENV !== 'test' || !/_(test|e2e)$/.test(process.env.TEST_DB_NAME || '')) throw new Error('Usa NODE_ENV=test y una base aislada.');
const destination = new URL('../../../docs/datos/', import.meta.url);
const original = JSON.parse(await readFile(new URL('modelo.json', destination), 'utf8'));
const descriptions = new Map(original.dic.map((table) => [table.table, table]));
const [columns] = await sequelize.query('SELECT TABLE_NAME, COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_KEY, COLUMN_DEFAULT, EXTRA FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = :database AND TABLE_NAME <> :meta ORDER BY TABLE_NAME, ORDINAL_POSITION', { replacements: { database: process.env.TEST_DB_NAME, meta: 'sequelizemeta' } });
const [foreignKeys] = await sequelize.query('SELECT TABLE_NAME, COLUMN_NAME, REFERENCED_TABLE_NAME, REFERENCED_COLUMN_NAME FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA = :database AND REFERENCED_TABLE_NAME IS NOT NULL ORDER BY TABLE_NAME, COLUMN_NAME', { replacements: { database: process.env.TEST_DB_NAME } });
const fks = foreignKeys.map((r) => ({ table: r.TABLE_NAME, column: r.COLUMN_NAME, ref: r.REFERENCED_TABLE_NAME, refcol: r.REFERENCED_COLUMN_NAME, card: '1:N' }));
const dic = [];
for (const table of [...new Set(columns.map((c) => c.TABLE_NAME))]) {
  const old = descriptions.get(table);
  dic.push({ module: table.startsWith('crm_') ? 'Admisiones CRM' : old?.module || 'Operación', table, purpose: old?.purpose || `Persistencia institucional de ${table.replace('crm_', '').replaceAll('_', ' ')}.`, columns: columns.filter((c) => c.TABLE_NAME === table).map((c) => {
    const fk = fks.find((f) => f.table === table && f.column === c.COLUMN_NAME);
    const previous = old?.columns.find((f) => f.name === c.COLUMN_NAME);
    return { name: c.COLUMN_NAME, type: c.COLUMN_TYPE, null: c.IS_NULLABLE === 'YES', key: c.COLUMN_KEY, default: c.COLUMN_DEFAULT, extra: c.EXTRA, purpose: previous?.purpose || (fk ? `Referencia a ${fk.ref}.${fk.refcol}.` : c.COLUMN_NAME.replaceAll('_', ' ')), fk: fk ? `${fk.ref}.${fk.refcol}` : null };
  }) });
}
const modules = Object.fromEntries([...new Set(dic.map((t) => t.module))].map((m) => [m, dic.filter((t) => t.module === m).map((t) => t.table)]));
await writeFile(new URL('modelo.json', destination), JSON.stringify({ dic, fks, modules, tables: dic.length, columns: columns.length }, null, 2) + '\n');
let markdown = `# Diccionario de datos de MENTOR AI\n\nGenerado por \`backend/src/scripts/exportDataModel.js\` desde una base aislada migrada: ${dic.length} tablas, ${columns.length} columnas, ${fks.length} llaves foráneas. No contiene datos de personas.\n\n`;
for (const [module, tables] of Object.entries(modules)) {
  markdown += `## ${module}\n\n`;
  for (const name of tables) { const table = dic.find((t) => t.table === name); markdown += `### \`${name}\`\n\n${table.purpose}\n\n| Campo | Tipo | Nulo | Llave | Propósito |\n| --- | --- | --- | --- | --- |\n`; for (const c of table.columns) markdown += `| \`${c.name}\` | \`${c.type.replaceAll('|', '/')}\` | ${c.null ? 'Sí' : 'No'} | ${c.fk ? `FK → ${c.fk}` : c.key} | ${c.purpose} |\n`; markdown += '\n'; }
}
await writeFile(new URL('diccionario-de-datos.md', destination), markdown.trimEnd() + '\n');
const escape = (s) => String(s).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
function diagram(tables, title) {
  const width = 1440; const boxWidth = 320; const rowHeight = 290; const height = Math.ceil(tables.length / 4) * rowHeight + 100;
  const positions = new Map(tables.map((table, i) => [table.table, { x: 20 + i % 4 * 355, y: 80 + Math.floor(i / 4) * rowHeight }]));
  const edges = fks.filter((f) => positions.has(f.table) && positions.has(f.ref)).map((f) => { const a = positions.get(f.table); const b = positions.get(f.ref); return `<path d="M${a.x + 160},${a.y} L${b.x + 160},${b.y + 240}" stroke="#94a3b8" stroke-width="1" fill="none"/>`; }).join('');
  const boxes = tables.map((t) => { const p = positions.get(t.table); const fields = t.columns.slice(0, 10).map((c, i) => `<text x="${p.x + 12}" y="${p.y + 58 + i * 17}" font-size="12">${escape(c.name)}${c.key === 'PRI' ? ' [PK]' : c.fk ? ' [FK]' : ''}</text>`).join(''); return `<g><rect x="${p.x}" y="${p.y}" width="${boxWidth}" height="240" rx="10" fill="#fff" stroke="#3451e1"/><text x="${p.x + 12}" y="${p.y + 28}" font-size="16" font-weight="bold">${escape(t.table)}</text>${fields}<text x="${p.x + 12}" y="${p.y + 229}" font-size="11">${t.columns.length} campos · detalles en diccionario</text></g>`; }).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escape(title)}"><rect width="100%" height="100%" fill="#f4f6fc"/><g font-family="Arial, sans-serif" fill="#14193d"><text x="20" y="38" font-size="26" font-weight="bold">${escape(title)}</text>${edges}${boxes}</g></svg>`;
}
await writeFile(new URL('er-7-crm.svg', destination), diagram(dic.filter((t) => t.table.startsWith('crm_')), 'Admisiones CRM · relaciones internas'));
await writeFile(new URL('er-general.svg', destination), diagram(dic, 'MENTOR AI · modelo completo desde migraciones'));
console.log(`Modelo actualizado: ${dic.length} tablas, ${columns.length} columnas, ${fks.length} relaciones.`);
await sequelize.close();
