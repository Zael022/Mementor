import { sequelize } from '../config/database.js';
import { readRagConfig } from '../config/rag.js';
import { readAiConfig } from '../services/aiProvider.js';
import { readStorageConfig } from '../services/fileStore.js';

// Revisa la conexión con MySQL e informa qué servicios están configurados, sin exponer claves ni nombres de proyecto.
export async function health(req, res) {
  await sequelize.authenticate();
  const ai = readAiConfig();
  const rag = readRagConfig();
  const storage = readStorageConfig();
  res.json({
    data: {
      status: 'ok',
      database: 'connected',
      tutor: { configured: ai.configured },
      retrieval: { mode: rag.mode, configured: rag.configured },
      // local solo es duradero con un disco persistente; gcs guarda los originales en Cloud Storage.
      files: { driver: storage.driver, configured: storage.configured },
      googleCloud: { required: rag.mode === 'vertex' || storage.driver === 'gcs', configured: rag.mode === 'vertex' || storage.driver === 'gcs' ? rag.configured && storage.configured : null },
    },
  });
}
