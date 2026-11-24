import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

// Ejecución de un agente de IA: quién, cuál, resultado, modelo, tamaño, tokens y latencia.
export const AgentRun = sequelize.define('AgentRun', {
  id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
  institutionId: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true },
  userId: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
  courseId: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true },
  agent: { type: DataTypes.STRING(40), allowNull: false },
  status: { type: DataTypes.ENUM('running', 'completed', 'no_evidence', 'failed'), allowNull: false, defaultValue: 'running' },
  provider: { type: DataTypes.STRING(40), allowNull: true },
  model: { type: DataTypes.STRING(120), allowNull: true },
  inputChars: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  outputChars: { type: DataTypes.INTEGER, allowNull: true },
  inputTokens: { type: DataTypes.INTEGER, allowNull: true },
  outputTokens: { type: DataTypes.INTEGER, allowNull: true },
  latencyMs: { type: DataTypes.INTEGER, allowNull: true },
  errorCode: { type: DataTypes.STRING(40), allowNull: true },
  promptVersion: { type: DataTypes.STRING(80), allowNull: true },
  modelTier: { type: DataTypes.STRING(20), allowNull: true },
  cacheHit: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  guardOutcome: { type: DataTypes.STRING(40), allowNull: true },
  cacheReadTokens: { type: DataTypes.INTEGER, allowNull: true },
  cacheWriteTokens: { type: DataTypes.INTEGER, allowNull: true },
}, { tableName: 'agent_runs', underscored: true });

// Respuesta reutilizable de un agente cuya entrada es idéntica y no personal (hoy, el resumen de lección).
export const AiResponseCache = sequelize.define('AiResponseCache', {
  id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
  cacheKey: { type: DataTypes.CHAR(64), allowNull: false },
  institutionId: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
  agent: { type: DataTypes.STRING(40), allowNull: false },
  promptVersion: { type: DataTypes.STRING(80), allowNull: false },
  model: { type: DataTypes.STRING(120), allowNull: false },
  sourceRef: { type: DataTypes.STRING(60), allowNull: false },
  outputJson: { type: DataTypes.JSON, allowNull: false },
  hits: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
  expiresAt: { type: DataTypes.DATE, allowNull: false },
}, { tableName: 'ai_response_cache', underscored: true });
