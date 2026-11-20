import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

// Solicitud de restablecimiento de contraseña (token de un solo uso).
export const PasswordReset = sequelize.define('PasswordReset', {
  id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
  userId: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
  tokenHash: { type: DataTypes.CHAR(64), allowNull: false },
  expiresAt: { type: DataTypes.DATE, allowNull: false },
  usedAt: { type: DataTypes.DATE, allowNull: true },
}, { tableName: 'password_resets', underscored: true });
