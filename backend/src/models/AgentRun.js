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
}, { tableName: 'agent_runs', underscored: true });
