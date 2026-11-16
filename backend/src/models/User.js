import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

// Representa a las personas que usan la plataforma.
export const User = sequelize.define('User', {
  id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
  institutionId: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true },
  email: { type: DataTypes.STRING(190), allowNull: false, unique: true },
  passwordHash: { type: DataTypes.STRING(255), allowNull: true },
  displayName: { type: DataTypes.STRING(120), allowNull: false },
  role: { type: DataTypes.ENUM('platform_admin', 'institution_admin', 'teacher', 'student'), allowNull: false },
  status: { type: DataTypes.ENUM('invited', 'active', 'disabled'), allowNull: false, defaultValue: 'invited' },
  invitationTokenHash: { type: DataTypes.CHAR(64), allowNull: true },
  invitationExpiresAt: { type: DataTypes.DATE, allowNull: true },
  failedLoginCount: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  lockedUntil: { type: DataTypes.DATE, allowNull: true },
}, { tableName: 'users', underscored: true });
