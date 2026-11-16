import { readdir, stat, unlink } from 'node:fs/promises';
import path from 'node:path';
import { Material } from '../models/index.js';
import { uploadDir } from '../middlewares/upload.js';

// Solo se tocan archivos con el patrón de nombre que genera MENTOR al recibir una carga.
const MANAGED_NAME = /^[0-9a-f]{32}\.[a-z0-9]{2,5}$/;

// Borra archivos de materiales ya eliminados; si alguno falla, la reconciliación lo reintenta.
export async function removeStoredFiles(storedNames) {
  for (const name of storedNames) {
    const base = path.basename(String(name || ''));
    if (!MANAGED_NAME.test(base)) continue;
    await unlink(path.join(uploadDir(), base)).catch(() => {});
  }
}

// Reconciliación segura: borra archivos administrados sin registro en MySQL y con más de una hora.
export async function reconcileUploads({ olderThanMs = 3600000 } = {}) {
  const dir = uploadDir();
  const names = (await readdir(dir)).filter((name) => MANAGED_NAME.test(name));
  if (!names.length) return { removed: 0 };
  const referenced = new Set((await Material.findAll({ where: { storedName: names }, attributes: ['storedName'], raw: true })).map((row) => row.storedName));
  let removed = 0;
  for (const name of names) {
    if (referenced.has(name)) continue;
    const info = await stat(path.join(dir, name)).catch(() => null);
    if (!info || Date.now() - info.mtimeMs < olderThanMs) continue;
    await unlink(path.join(dir, name)).then(() => { removed += 1; }).catch(() => {});
  }
  return { removed };
}
