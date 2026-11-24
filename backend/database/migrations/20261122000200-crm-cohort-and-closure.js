'use strict';

module.exports = {
  async up(q, S) {
    await q.addColumn('crm_applications', 'acquisition_origin', { type: S.STRING(80), allowNull: true });
    await q.addColumn('crm_applications', 'closed_at', { type: S.DATE, allowNull: true });
    await q.addIndex('crm_applications', ['institution_id', 'cycle_id', 'config_version', 'created_at'], { name: 'ix_crm_cohort' });
    await q.addIndex('crm_applications', ['institution_id', 'status', 'closed_at'], { name: 'ix_crm_retention' });
    await q.addIndex('crm_followups', ['application_id', 'status', 'due_at'], { name: 'ix_crm_application_followups' });
  },
  async down(q) {
    const indexes = await q.showIndex('crm_followups');
    if (!indexes.some((i) => i.name !== 'ix_crm_application_followups' && i.fields[0]?.attribute === 'application_id')) await q.addIndex('crm_followups', ['application_id'], { name: 'ix_crm_followup_application_fk' });
    await q.removeIndex('crm_followups', 'ix_crm_application_followups');
    await q.removeIndex('crm_applications', 'ix_crm_retention');
    await q.removeIndex('crm_applications', 'ix_crm_cohort');
    await q.removeColumn('crm_applications', 'closed_at');
    await q.removeColumn('crm_applications', 'acquisition_origin');
  },
};
