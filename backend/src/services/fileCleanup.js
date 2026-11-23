import { Material } from '../models/index.js';
import { isManagedName, listStored, removeStored } from './fileStore.js';

// Borra originales de materiales ya eliminados; si alguno falla, la reconciliación lo reintenta.
export async function removeStoredFiles(storedNames) {
  for (const name of storedNames) {
    if (!isManagedName(name)) continue;
    await removeStored('materials', name).catch(() => {});
  }
}

// Reconciliación segura: borra originales administrados sin registro en MySQL y con más de una hora.
export async function reconcileUploads({ olderThanMs = 3600000 } = {}) {
  const items = await listStored('materials');
  if (!items.length) return { removed: 0 };
  const referenced = new Set((await Material.findAll({ where: { storedName: items.map((item) => item.name) }, attributes: ['storedName'], raw: true })).map((row) => row.storedName));
  let removed = 0;
  for (const { name, createdMs } of items) {
    if (referenced.has(name) || Date.now() - createdMs < olderThanMs) continue;
    await removeStored('materials', name).then(() => { removed += 1; }).catch(() => {});
  }
  return { removed };
}
