import { sequelize } from '../config/database.js';
import { readRagConfig } from '../config/rag.js';
import { readAiConfig } from '../services/aiProvider.js';

// Revisa la conexión con MySQL e informa qué servicios están configurados, sin exponer claves ni nombres de proyecto.
export async function health(req, res) {
  await sequelize.authenticate();
  const ai = readAiConfig();
  const rag = readRagConfig();
  res.json({
    data: {
      status: 'ok',
      database: 'connected',
      tutor: { configured: ai.configured },
      retrieval: { mode: rag.mode, configured: rag.configured },
      googleCloud: { required: rag.mode === 'vertex', configured: rag.mode === 'vertex' ? rag.configured : null },
    },
  });
}
