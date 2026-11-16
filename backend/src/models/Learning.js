import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

// Cada atributo necesita su propio objeto de definición.
const id = () => ({ type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true });
const ref = () => ({ type: DataTypes.BIGINT.UNSIGNED, allowNull: false });

// Guarda el dominio estimado de un estudiante en un tema.
export const TopicMastery = sequelize.define('TopicMastery', {
  id: id(),
  studentId: ref(),
  topicId: ref(),
  masteryScore: { type: DataTypes.DECIMAL(4, 3), allowNull: false },
  evidenceCount: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  algorithmVersion: { type: DataTypes.STRING(40), allowNull: false },
}, { tableName: 'topic_mastery', underscored: true });

// Guarda la recomendación vigente y su motivo.
export const LearningRecommendation = sequelize.define('LearningRecommendation', {
  id: id(),
  studentId: ref(),
  courseId: ref(),
  topicId: ref(),
  nextTopicId: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true },
  type: { type: DataTypes.ENUM('reinforce', 'practice', 'advance'), allowNull: false },
  reason: { type: DataTypes.STRING(500), allowNull: false },
  status: { type: DataTypes.ENUM('active', 'replaced', 'dismissed'), allowNull: false, defaultValue: 'active' },
}, { tableName: 'learning_recommendations', underscored: true });

// Representa una conversación con el tutor.
export const AiThread = sequelize.define('AiThread', {
  id: id(),
  userId: ref(),
  courseId: ref(),
  title: { type: DataTypes.STRING(180), allowNull: false },
}, { tableName: 'ai_threads', underscored: true });

// Guarda cada mensaje del tutor con sus citas.
export const AiMessage = sequelize.define('AiMessage', {
  id: id(),
  threadId: ref(),
  role: { type: DataTypes.ENUM('user', 'assistant'), allowNull: false },
  content: { type: DataTypes.TEXT, allowNull: false },
  citationsJson: { type: DataTypes.JSON, allowNull: true },
  grounded: { type: DataTypes.BOOLEAN, allowNull: true },
  model: { type: DataTypes.STRING(120), allowNull: true },
  kind: { type: DataTypes.ENUM('answer', 'notice'), allowNull: false, defaultValue: 'answer' },
  noticeCode: { type: DataTypes.STRING(60), allowNull: true },
}, { tableName: 'ai_messages', underscored: true });

// Registra acciones sensibles para auditoría.
export const AuditLog = sequelize.define('AuditLog', {
  id: id(),
  institutionId: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true },
  actorId: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true },
  action: { type: DataTypes.STRING(80), allowNull: false },
  resourceType: { type: DataTypes.STRING(60), allowNull: false },
  resourceId: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true },
  metadataJson: { type: DataTypes.JSON, allowNull: true },
}, { tableName: 'audit_logs', underscored: true, updatedAt: false });
