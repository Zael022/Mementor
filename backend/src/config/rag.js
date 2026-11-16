// Lee la configuración del motor de recuperación (local o Vertex AI RAG Engine).

const toNumber = (value, fallback) => {
  const number = Number(value);
  return Number.isFinite(number) && value !== '' && value !== undefined ? number : fallback;
};

export function readRagConfig() {
  const mode = (process.env.RAG_PROVIDER || 'local').trim().toLowerCase();
  const config = {
    mode,
    project: (process.env.GOOGLE_CLOUD_PROJECT || '').trim(),
    location: (process.env.GOOGLE_CLOUD_LOCATION || '').trim(),
    bucket: (process.env.RAG_GCS_BUCKET || '').trim(),
    prefix: (process.env.RAG_GCS_PREFIX || 'mentor-ai').trim().replace(/^\/+|\/+$/g, ''),
    topK: Math.min(20, Math.max(1, toNumber(process.env.RAG_TOP_K, 6))),
    // Distancia vectorial máxima aceptada; se calibra en un proyecto de prueba (vacío = sin filtro).
    maxDistance: process.env.RAG_VECTOR_DISTANCE_THRESHOLD ? toNumber(process.env.RAG_VECTOR_DISTANCE_THRESHOLD, null) : null,
    chunkSize: toNumber(process.env.RAG_CHUNK_SIZE, 512),
    chunkOverlap: toNumber(process.env.RAG_CHUNK_OVERLAP, 100),
    embeddingModel: (process.env.RAG_EMBEDDING_MODEL || '').trim(),
    maxDocuments: toNumber(process.env.MAX_DOCUMENTS_PER_INSTITUTION, 500),
  };
  if (!['local', 'vertex'].includes(mode)) {
    return { ...config, configured: false, reason: `RAG_PROVIDER "${mode}" no es válido (usa local o vertex).` };
  }
  if (mode === 'vertex') {
    const missing = [['GOOGLE_CLOUD_PROJECT', config.project], ['GOOGLE_CLOUD_LOCATION', config.location], ['RAG_GCS_BUCKET', config.bucket]]
      .filter(([, value]) => !value).map(([name]) => name);
    if (missing.length) return { ...config, configured: false, reason: `Falta configurar ${missing.join(', ')} para RAG_PROVIDER=vertex.` };
  }
  return { ...config, configured: true };
}
