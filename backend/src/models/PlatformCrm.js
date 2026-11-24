import { DataTypes as D } from 'sequelize';
import { sequelize } from '../config/database.js';

const id = () => ({ type: D.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true });
const ref = () => ({ type: D.BIGINT.UNSIGNED, allowNull: false });
export const PlatformCrmAccount = sequelize.define('PlatformCrmAccount', {
  id: id(), institutionId: { ...ref(), unique: true }, responsibleId: ref(),
  onboardingStatus: { type: D.STRING(24), allowNull: false, defaultValue: 'pending' },
  needs: { type: D.STRING(2000) }, nextReviewAt: { type: D.DATE },
  version: { type: D.INTEGER, allowNull: false, defaultValue: 1 },
}, { tableName: 'platform_crm_accounts', underscored: true });
export const PlatformCrmContact = sequelize.define('PlatformCrmContact', {
  id: id(), accountId: ref(), name: { type: D.STRING(120), allowNull: false },
  position: { type: D.STRING(120) }, email: { type: D.STRING(190) }, phone: { type: D.STRING(30) }, requestKey: { type: D.STRING(36), allowNull: false }, actorId: ref(),
}, { tableName: 'platform_crm_contacts', underscored: true });
