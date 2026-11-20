import { ConsentRecord } from '../models/index.js';

// Versión vigente de cada documento; si cambia, se vuelve a pedir la aceptación.
export const POLICY_VERSIONS = Object.freeze({ terms: '2026-11-21', privacy: '2026-11-21' });

// Documentos que la persona aún no ha aceptado en su versión vigente.
export async function pendingConsents(userId) {
  const rows = await ConsentRecord.findAll({ where: { userId }, attributes: ['document', 'version'] });
  return Object.entries(POLICY_VERSIONS)
    .filter(([document, version]) => !rows.some((row) => row.document === document && row.version === version))
    .map(([document, version]) => ({ document, version }));
}

// Registra la aceptación de las versiones vigentes (no duplica si ya existía).
export async function acceptPolicies(userId, documents, { transaction } = {}) {
  const now = new Date();
  for (const document of documents) {
    await ConsentRecord.findOrCreate({
      where: { userId, document, version: POLICY_VERSIONS[document] },
      defaults: { acceptedAt: now },
      transaction,
    });
  }
}
