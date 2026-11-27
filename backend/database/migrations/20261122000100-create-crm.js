'use strict';

// Esquema aditivo de admisiones; no inserta personas ni convocatorias.
module.exports = {
  async up(q, S) {
    const id = () => ({ type: S.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true, allowNull: false });
    const ref = (table, nullable = false, onDelete = 'RESTRICT') => ({ type: S.BIGINT.UNSIGNED, allowNull: nullable, references: { model: table, key: 'id' }, onDelete, onUpdate: 'CASCADE' });
    const text = (n, nullable = false) => ({ type: S.STRING(n), allowNull: nullable });
    const date = (nullable = true) => ({ type: S.DATE, allowNull: nullable });
    const json = (nullable = false) => ({ type: S.JSON, allowNull: nullable });
    const version = () => ({ type: S.INTEGER, allowNull: false, defaultValue: 1 });
    const create = (table, attrs) => q.createTable(table, { id: id(), institution_id: ref('institutions'), ...attrs, created_at: date(false), updated_at: date(false) });
    await create('crm_admission_cycles', {
      course_id: ref('courses'), name: text(180), campus: text(120), starts_at: date(false), ends_at: date(false), status: text(20),
      version: version(), config_json: json(), config_history: json(),
    });
    await create('crm_prospects', { name: text(120), email: text(190, true), phone: text(30, true), origin: text(80), utm_json: json(true), user_id: ref('users', true, 'SET NULL'), anonymized_at: date() });
    await q.addIndex('crm_prospects', ['institution_id', 'email'], { unique: true, name: 'ux_crm_prospect_email' });
    await create('crm_applications', {
      prospect_id: ref('crm_prospects'), cycle_id: ref('crm_admission_cycles'), stage: text(30), status: text(25), responsible_id: ref('users', true),
      version: version(), last_stage_changed_at: date(false), last_contact_at: date(), reviewed_at: date(), config_version: version(),
      config_json: json(), activity_json: json(), enrollment_id: ref('enrollments', true), conversion_kind: text(25, true), converted_at: date(), retention_exception: text(300, true),
    });
    await q.addIndex('crm_applications', ['prospect_id', 'cycle_id'], { unique: true, name: 'ux_crm_application_cycle' });
    await q.addIndex('crm_applications', ['institution_id', 'cycle_id', 'stage', 'status'], { name: 'ix_crm_funnel' });
    await q.addIndex('crm_applications', ['institution_id', 'responsible_id', 'last_stage_changed_at'], { name: 'ix_crm_responsible' });
    await create('crm_stage_events', { application_id: ref('crm_applications'), from_stage: text(30, true), to_stage: text(30), kind: text(25), reason: text(500), actor_id: ref('users', true), effective_at: date(false), recorded_at: date(false), metadata_json: json(true) });
    await q.addIndex('crm_stage_events', ['institution_id', 'application_id', 'effective_at', 'recorded_at'], { name: 'ix_crm_event_history' });
    await create('crm_followups', { application_id: ref('crm_applications'), responsible_id: ref('users'), due_at: date(false), type: text(30), status: text(20), note: text(500, true), result: text(300, true), completed_at: date() });
    await q.addIndex('crm_followups', ['institution_id', 'responsible_id', 'status', 'due_at'], { name: 'ix_crm_followup_due' });
    await create('crm_message_drafts', { application_id: ref('crm_applications'), author_id: ref('users'), approver_id: ref('users', true), agent_run_id: ref('agent_runs', true, 'SET NULL'), text: { type: S.TEXT, allowNull: false }, channel: text(20), recipient: text(190), status: text(20), version: version(), context_hash: text(64), context_json: json(), approved_at: date(), approved_version: { type: S.INTEGER }, source: text(20) });
    await create('crm_consent_records', { prospect_id: ref('crm_prospects'), purpose: text(30), document_version: text(40), evidence_ref: text(200), origin: text(80), accepted_at: date(false), revoked_at: date() });
    await create('crm_privacy_cases', { prospect_id: ref('crm_prospects'), actor_id: ref('users'), action: text(20), verification_ref: text(200), verified_at: date(false), reason: text(300), completed_at: date(false) });
    for (const table of ['crm_admission_cycles', 'crm_message_drafts', 'crm_consent_records', 'crm_privacy_cases']) await q.addIndex(table, ['institution_id', 'created_at'], { name: `ix_${table}_institution` });
  },
  async down(q) {
    for (const table of ['crm_privacy_cases', 'crm_consent_records', 'crm_message_drafts', 'crm_followups', 'crm_stage_events', 'crm_applications', 'crm_prospects', 'crm_admission_cycles']) await q.dropTable(table, {});
  },
};
