import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

// Guarda las sesiones activas sin almacenar el token original.
export const UserSession = sequelize.define('UserSession', {
  id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
  userId: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
  tokenHash: { type: DataTypes.CHAR(64), allowNull: false, unique: true },
  csrfToken: { type: DataTypes.CHAR(64), allowNull: false },
  expiresAt: { type: DataTypes.DATE, allowNull: false },
  revokedAt: { type: DataTypes.DATE, allowNull: true },
}, { tableName: 'user_sessions', underscored: true });
