import { DataTypes as D } from 'sequelize';
import { sequelize } from '../config/database.js';

const id = () => ({ type: D.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true });
const ref = (allowNull = false) => ({ type: D.BIGINT.UNSIGNED, allowNull });
const str = (n, allowNull = false) => ({ type: D.STRING(n), allowNull });
const date = (allowNull = true) => ({ type: D.DATE, allowNull });
const model = (name, tableName, fields) => sequelize.define(name, { id: id(), institutionId: ref(), ...fields }, { tableName, underscored: true });

export const CrmCycle = model('CrmCycle', 'crm_admission_cycles', {
  courseId: ref(), name: str(180), campus: str(120), startsAt: date(false), endsAt: date(false),
  status: { ...str(20), defaultValue: 'open' }, version: { type: D.INTEGER, defaultValue: 1, allowNull: false },
  configJson: { type: D.JSON, allowNull: false }, configHistory: { type: D.JSON, allowNull: false },
});
export const CrmProspect = model('CrmProspect', 'crm_prospects', {
  name: str(120), email: str(190, true), phone: str(30, true), origin: str(80), utmJson: { type: D.JSON },
  userId: ref(true), anonymizedAt: date(),
});
export const CrmApplication = model('CrmApplication', 'crm_applications', {
  prospectId: ref(), cycleId: ref(), stage: str(30), status: { ...str(25), defaultValue: 'activo' }, responsibleId: ref(true),
  version: { type: D.INTEGER, allowNull: false, defaultValue: 1 }, lastStageChangedAt: date(false), lastContactAt: date(), reviewedAt: date(),
  configVersion: { type: D.INTEGER, allowNull: false }, configJson: { type: D.JSON, allowNull: false }, activityJson: { type: D.JSON, allowNull: false },
  enrollmentId: ref(true), conversionKind: str(25, true), convertedAt: date(), retentionException: str(300, true),
  acquisitionOrigin: str(80, true), closedAt: date(),
});
export const CrmStageEvent = model('CrmStageEvent', 'crm_stage_events', {
  applicationId: ref(), fromStage: str(30, true), toStage: str(30), kind: str(25), reason: str(500), actorId: ref(true),
  effectiveAt: date(false), recordedAt: date(false), metadataJson: { type: D.JSON },
});
export const CrmFollowup = model('CrmFollowup', 'crm_followups', {
  applicationId: ref(), responsibleId: ref(), dueAt: date(false), type: str(30), status: { ...str(20), defaultValue: 'pending' },
  note: str(500, true), result: str(300, true), completedAt: date(),
});
export const CrmDraft = model('CrmDraft', 'crm_message_drafts', {
  applicationId: ref(), authorId: ref(), approverId: ref(true), agentRunId: ref(true), text: { type: D.TEXT, allowNull: false },
  channel: str(20), recipient: str(190), status: { ...str(20), defaultValue: 'pending' },
  version: { type: D.INTEGER, allowNull: false, defaultValue: 1 }, contextHash: str(64), contextJson: { type: D.JSON, allowNull: false },
  approvedAt: date(), approvedVersion: { type: D.INTEGER }, source: str(20),
});
export const CrmConsent = model('CrmConsent', 'crm_consent_records', {
  prospectId: ref(), purpose: str(30), documentVersion: str(40), evidenceRef: str(200), origin: str(80), acceptedAt: date(false), revokedAt: date(),
});
export const CrmPrivacyCase = model('CrmPrivacyCase', 'crm_privacy_cases', {
  prospectId: ref(), actorId: ref(), action: str(20), verificationRef: str(200), verifiedAt: date(false), reason: str(300), completedAt: date(false),
});
