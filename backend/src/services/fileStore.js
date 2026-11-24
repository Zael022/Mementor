import { createHash } from 'node:crypto';
import { readFile, readdir, stat, unlink } from 'node:fs/promises';
import path from 'node:path';
import { avatarDir, uploadDir } from '../middlewares/upload.js';
import { GoogleCallError, googleRequest } from './googleCloud.js';
import { notFound } from '../utils/AppError.js';

// Almacén de originales (materiales y fotos de perfil).
// local: los archivos quedan en el disco del servidor (desarrollo o servidor con volumen persistente).
// gcs: el archivo recibido se copia a un bucket privado de Cloud Storage con ADC y se borra del disco temporal,
// así un reinicio o redespliegue no pierde los originales.

const AREAS = { materials: () => uploadDir(), avatars: () => avatarDir() };
// Solo se manejan nombres generados por MENTOR al recibir la carga.
const MANAGED_NAME = /^[0-9a-f]{32}\.[a-z0-9]{2,5}$/;

export function readStorageConfig() {
  const driver = (process.env.STORAGE_DRIVER || 'local').trim().toLowerCase();
  const bucket = (process.env.STORAGE_GCS_BUCKET || '').trim();
  const prefix = (process.env.STORAGE_GCS_PREFIX || 'mentor-ai/originales').trim().replace(/^\/+|\/+$/g, '');
  if (!['local', 'gcs'].includes(driver)) return { driver, bucket, prefix, configured: false, reason: `STORAGE_DRIVER "${driver}" no es válido (usa local o gcs).` };
  if (driver === 'gcs' && !bucket) return { driver, bucket, prefix, configured: false, reason: 'Falta STORAGE_GCS_BUCKET para STORAGE_DRIVER=gcs.' };
  return { driver, bucket, prefix, configured: true };
}

function checkArea(area) {
  if (!AREAS[area]) throw new Error(`Área de archivos desconocida: ${area}`);
}

export function isManagedName(name) {
  return MANAGED_NAME.test(path.basename(String(name || '')));
}

const localPath = (area, name) => path.join(AREAS[area](), path.basename(String(name)));
const objectName = (config, area, name) => `${config.prefix}/${area}/${path.basename(String(name))}`;
const objectUrl = (config, area, name) => `https://storage.googleapis.com/storage/v1/b/${encodeURIComponent(config.bucket)}/o/${encodeURIComponent(objectName(config, area, name))}`;

function requireConfig() {
  const config = readStorageConfig();
  if (!config.configured) throw new Error(config.reason);
  return config;
}

export const sha256 = (buffer) => createHash('sha256').update(buffer).digest('hex');

// Guarda de forma duradera un archivo que multer dejó en disco. Devuelve su huella SHA-256.
export async function persistUpload(area, name) {
  checkArea(area);
  const config = requireConfig();
  const source = localPath(area, name);
  const buffer = await readFile(source);
  if (config.driver === 'gcs') {
    const query = new URLSearchParams({ uploadType: 'media', name: objectName(config, area, name), ifGenerationMatch: '0' });
    await googleRequest({
      method: 'POST',
      url: `https://storage.googleapis.com/upload/storage/v1/b/${encodeURIComponent(config.bucket)}/o?${query}`,
      body: buffer,
      contentType: 'application/octet-stream',
    });
    await unlink(source).catch(() => {});
  }
  return sha256(buffer);
}

// Lee el original; si no existe responde 404 sin revelar dónde se guarda.
export async function readStored(area, name) {
  checkArea(area);
  const config = requireConfig();
  if (config.driver === 'gcs') {
    try {
      return await googleRequest({ url: `${objectUrl(config, area, name)}?alt=media`, responseType: 'buffer' });
    } catch (error) {
      if (error instanceof GoogleCallError && error.status === 404) throw notFound('El archivo ya no está disponible.');
      throw error;
    }
  }
  try {
    return await readFile(localPath(area, name));
  } catch (error) {
    if (error.code === 'ENOENT') throw notFound('El archivo ya no está disponible.');
    throw error;
  }
}

// Borra el original; si ya no existía, se considera borrado.
export async function removeStored(area, name) {
  checkArea(area);
  if (!isManagedName(name)) return;
  const config = readStorageConfig();
  if (config.driver === 'gcs' && config.configured) {
    try {
      await googleRequest({ method: 'DELETE', url: objectUrl(config, area, name) });
    } catch (error) {
      if (!(error instanceof GoogleCallError && error.status === 404)) throw error;
    }
  }
  // También el disco local: en gcs puede quedar una copia temporal si la subida falló.
  await unlink(localPath(area, name)).catch(() => {});
}

// Borra una carga recibida que no llegó a registrarse (solo el temporal local y, si se alcanzó a subir, el objeto).
export async function discardUpload(area, name) {
  await removeStored(area, name).catch(() => {});
}

// Lista los nombres administrados con su antigüedad, para la reconciliación de huérfanos.
export async function listStored(area) {
  checkArea(area);
  const config = requireConfig();
  const items = [];
  if (config.driver === 'gcs') {
    let pageToken = '';
    do {
      const query = new URLSearchParams({ prefix: `${config.prefix}/${area}/`, fields: 'items(name,timeCreated),nextPageToken', ...(pageToken ? { pageToken } : {}) });
      const page = await googleRequest({ url: `https://storage.googleapis.com/storage/v1/b/${encodeURIComponent(config.bucket)}/o?${query}` });
      for (const item of page.items || []) {
        const name = path.basename(item.name);
        if (MANAGED_NAME.test(name)) items.push({ name, createdMs: Date.parse(item.timeCreated) || Date.now() });
      }
      pageToken = page.nextPageToken || '';
    } while (pageToken);
    return items;
  }
  const dir = AREAS[area]();
  for (const name of (await readdir(dir)).filter((entry) => MANAGED_NAME.test(entry))) {
    const info = await stat(path.join(dir, name)).catch(() => null);
    if (info?.isFile()) items.push({ name, createdMs: info.mtimeMs });
  }
  return items;
}
