import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

// Cambio de correo pendiente de confirmar desde la nueva dirección (token de un solo uso).
export const EmailChange = sequelize.define('EmailChange', {
  id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
  userId: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
  newEmail: { type: DataTypes.STRING(190), allowNull: false },
  tokenHash: { type: DataTypes.CHAR(64), allowNull: false },
  expiresAt: { type: DataTypes.DATE, allowNull: false },
  usedAt: { type: DataTypes.DATE, allowNull: true },
}, { tableName: 'email_changes', underscored: true });
