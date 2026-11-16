import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

// Representa cada institución académica.
export const Institution = sequelize.define('Institution', {
  id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
  name: { type: DataTypes.STRING(150), allowNull: false },
  slug: { type: DataTypes.STRING(100), allowNull: false, unique: true },
  status: { type: DataTypes.ENUM('active', 'inactive'), allowNull: false, defaultValue: 'active' },
  maxDocuments: { type: DataTypes.INTEGER, allowNull: true },
  aiDailyQuestionLimit: { type: DataTypes.INTEGER, allowNull: true },
}, { tableName: 'institutions', underscored: true });
