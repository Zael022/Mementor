import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

// Aceptación de una versión de los términos o de la política de privacidad.
export const ConsentRecord = sequelize.define('ConsentRecord', {
  id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
  userId: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
  document: { type: DataTypes.ENUM('terms', 'privacy'), allowNull: false },
  version: { type: DataTypes.STRING(20), allowNull: false },
  acceptedAt: { type: DataTypes.DATE, allowNull: false },
}, { tableName: 'consent_records', underscored: true });

// Solicitud de baja y eliminación de datos personales.
export const DataDeletionRequest = sequelize.define('DataDeletionRequest', {
  id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
  userId: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
  institutionId: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true },
  status: { type: DataTypes.ENUM('pending', 'completed', 'rejected'), allowNull: false, defaultValue: 'pending' },
  reason: { type: DataTypes.STRING(500), allowNull: true },
  identityConfirmedAt: { type: DataTypes.DATE, allowNull: false },
  processedAt: { type: DataTypes.DATE, allowNull: true },
  processedVia: { type: DataTypes.ENUM('app', 'n8n'), allowNull: true },
  retainedSummary: { type: DataTypes.TEXT, allowNull: true },
  notificationStatus: { type: DataTypes.ENUM('sent', 'not_configured', 'failed'), allowNull: true },
}, { tableName: 'data_deletion_requests', underscored: true });
