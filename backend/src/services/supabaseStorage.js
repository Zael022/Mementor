// Cliente mínimo de Supabase Storage (API REST) para guardar los originales en un bucket privado.
// Solo lo usa el backend con la clave secreta del proyecto; el navegador nunca recibe esa clave
// y descarga los archivos a través de la API de MENTOR, que revisa permisos antes de entregarlos.

export class SupabaseCallError extends Error {
  constructor(status, message) {
    super(message);
    this.name = 'SupabaseCallError';
    this.status = status;
  }
}

export function readSupabaseConfig() {
  const url = (process.env.SUPABASE_URL || '').trim().replace(/\/+$/, '');
  const key = (process.env.SUPABASE_SECRET_KEY || '').trim();
  const bucket = (process.env.SUPABASE_BUCKET || '').trim();
  const missing = [!url && 'SUPABASE_URL', !key && 'SUPABASE_SECRET_KEY', !bucket && 'SUPABASE_BUCKET'].filter(Boolean);
  if (missing.length) return { configured: false, reason: `Falta ${missing.join(', ')} para STORAGE_DRIVER=supabase.` };
  if (!/^https:\/\//.test(url) && !/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(url)) {
    return { configured: false, reason: 'SUPABASE_URL debe empezar con https:// (por ejemplo https://<proyecto>.supabase.co).' };
  }
  return { configured: true, url, key, bucket };
}

// Las claves nuevas (sb_secret_…) van solo en «apikey»; la clave antigua service_role es un JWT y también va en Authorization.
const authHeaders = (key) => ({ apikey: key, ...(key.startsWith('eyJ') ? { Authorization: `Bearer ${key}` } : {}) });

// Transporte HTTP real; las pruebas lo cambian por un doble en memoria.
async function fetchTransport({ method, url, headers, body }) {
  const response = await fetch(url, { method, headers, body, signal: AbortSignal.timeout(30000) });
  const buffer = Buffer.from(await response.arrayBuffer());
  return { status: response.status, buffer };
}
let transport = fetchTransport;
export function setSupabaseTransportForTests(fake) {
  transport = fake || fetchTransport;
}

// Cada parte de la ruta se codifica por separado para conservar las barras.
const encodePath = (objectPath) => objectPath.split('/').map(encodeURIComponent).join('/');

async function call(config, { method = 'GET', path, json, body, contentType, extraHeaders = {} }) {
  const headers = { ...authHeaders(config.key), ...extraHeaders };
  let payload = body;
  if (json !== undefined) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(json);
  } else if (contentType) headers['Content-Type'] = contentType;
  const { status, buffer } = await transport({ method, url: `${config.url}/storage/v1/${path}`, headers, body: payload });
  if (status >= 200 && status < 300) return buffer;
  // Supabase a veces responde 400 con {"statusCode":"404"} cuando el objeto no existe.
  let detail = {};
  try { detail = JSON.parse(buffer.toString('utf8') || '{}'); } catch { detail = {}; }
  const real = Number(detail.statusCode) || status;
  throw new SupabaseCallError(real, `Supabase Storage respondió ${real}${detail.error ? ` (${detail.error})` : ''}`);
}

export async function uploadObject(config, objectPath, buffer) {
  // x-upsert false: nunca se reemplaza un original ya guardado.
  await call(config, {
    method: 'POST', path: `object/${encodeURIComponent(config.bucket)}/${encodePath(objectPath)}`,
    body: buffer, contentType: 'application/octet-stream', extraHeaders: { 'x-upsert': 'false' },
  });
}

export async function downloadObject(config, objectPath) {
  return call(config, { path: `object/authenticated/${encodeURIComponent(config.bucket)}/${encodePath(objectPath)}` });
}

// Borrar algo que ya no existe no es error: Supabase responde la lista de lo que sí borró.
export async function deleteObject(config, objectPath) {
  await call(config, { method: 'DELETE', path: `object/${encodeURIComponent(config.bucket)}`, json: { prefixes: [objectPath] } });
}

// Lista los archivos de una carpeta por páginas. Devuelve nombre (sin carpeta) y fecha de creación.
export async function listFolder(config, folder) {
  const items = [];
  const limit = 1000;
  for (let offset = 0; ; offset += limit) {
    const page = JSON.parse((await call(config, {
      method: 'POST', path: `object/list/${encodeURIComponent(config.bucket)}`,
      json: { prefix: folder, limit, offset, sortBy: { column: 'name', order: 'asc' } },
    })).toString('utf8') || '[]');
    for (const item of page) if (item.id) items.push({ name: item.name, createdMs: Date.parse(item.created_at) || Date.now() });
    if (page.length < limit) return items;
  }
}
