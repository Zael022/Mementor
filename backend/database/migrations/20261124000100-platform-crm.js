'use strict';

module.exports = {
  async up(q, S) {
    const id = () => ({ type: S.BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true, allowNull: false });
    const ref = (table) => ({ type: S.BIGINT.UNSIGNED, allowNull: false, references: { model: table, key: 'id' }, onDelete: 'RESTRICT', onUpdate: 'CASCADE' });
    const timestamps = () => ({ created_at: { type: S.DATE, allowNull: false }, updated_at: { type: S.DATE, allowNull: false } });
    await q.createTable('platform_crm_accounts', {
      id: id(), institution_id: ref('institutions'), responsible_id: ref('users'),
      onboarding_status: { type: S.STRING(24), allowNull: false, defaultValue: 'pending' },
      needs: { type: S.STRING(2000), allowNull: true }, next_review_at: { type: S.DATE, allowNull: true },
      version: { type: S.INTEGER, allowNull: false, defaultValue: 1 }, ...timestamps(),
    });
    await q.addIndex('platform_crm_accounts', ['institution_id'], { unique: true, name: 'ux_platform_crm_institution' });
    await q.createTable('platform_crm_contacts', {
      id: id(), account_id: ref('platform_crm_accounts'), name: { type: S.STRING(120), allowNull: false },
      position: { type: S.STRING(120), allowNull: true }, email: { type: S.STRING(190), allowNull: true },
      phone: { type: S.STRING(30), allowNull: true }, request_key: { type: S.STRING(36), allowNull: false }, actor_id: ref('users'), ...timestamps(),
    });
    await q.addIndex('platform_crm_contacts', ['account_id'], { name: 'ix_platform_crm_contacts_account' });
    await q.addIndex('platform_crm_contacts', ['account_id', 'request_key'], { unique: true, name: 'ux_platform_crm_contact_request' });
  },
  async down(q) {
    await q.dropTable('platform_crm_contacts');
    await q.dropTable('platform_crm_accounts');
  },
};
