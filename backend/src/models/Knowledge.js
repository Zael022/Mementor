import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

// Cada atributo necesita su propio objeto de definición.
const id = () => ({ type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true });
const ref = (allowNull = false) => ({ type: DataTypes.BIGINT.UNSIGNED, allowNull });

// Corpus de RAG Engine que agrupa las fuentes de un curso.
export const CourseRagCorpus = sequelize.define('CourseRagCorpus', {
  id: id(),
  institutionId: ref(),
  courseId: ref(),
  corpusName: { type: DataTypes.STRING(300), allowNull: true },
  operationName: { type: DataTypes.STRING(400), allowNull: true },
  status: { type: DataTypes.ENUM('pending', 'creating', 'ready', 'error'), allowNull: false, defaultValue: 'pending' },
  lastError: { type: DataTypes.STRING(500), allowNull: true },
}, { tableName: 'course_rag_corpora', underscored: true });

// Documento que el tutor puede consultar dentro de un curso.
export const KnowledgeSource = sequelize.define('KnowledgeSource', {
  id: id(),
  institutionId: ref(),
  courseId: ref(),
  origin: { type: DataTypes.ENUM('lesson', 'material', 'drive'), allowNull: false },
  sourceKey: { type: DataTypes.STRING(180), allowNull: false },
  lessonId: ref(true),
  materialId: ref(true),
  driveFileId: { type: DataTypes.STRING(128), allowNull: true },
  driveLinkId: ref(true),
  lastSeenRun: { type: DataTypes.STRING(36), allowNull: true },
  title: { type: DataTypes.STRING(200), allowNull: false },
  status: { type: DataTypes.ENUM('active', 'retired'), allowNull: false, defaultValue: 'active' },
  retiredAt: { type: DataTypes.DATE, allowNull: true },
  retireReason: { type: DataTypes.STRING(60), allowNull: true },
  activeVersionId: ref(true),
  cleanupStatus: { type: DataTypes.ENUM('none', 'pending', 'done', 'error'), allowNull: false, defaultValue: 'none' },
  cleanupAttempts: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  cleanupError: { type: DataTypes.STRING(500), allowNull: true },
  createdBy: ref(true),
}, { tableName: 'knowledge_sources', underscored: true });

// Versión concreta de una fuente: texto extraído y ubicación del archivo indexado.
export const SourceVersion = sequelize.define('SourceVersion', {
  id: id(),
  sourceId: ref(),
  courseId: ref(),
  versionNo: { type: DataTypes.INTEGER, allowNull: false },
  contentHash: { type: DataTypes.CHAR(64), allowNull: false },
  state: { type: DataTypes.ENUM('pending', 'processing', 'ready', 'error', 'superseded', 'retired'), allowNull: false, defaultValue: 'pending' },
  errorCode: { type: DataTypes.STRING(60), allowNull: true },
  errorMessage: { type: DataTypes.STRING(500), allowNull: true },
  textContent: { type: DataTypes.TEXT('long'), allowNull: false },
  charCount: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  pagesJson: { type: DataTypes.JSON, allowNull: true },
  mimeType: { type: DataTypes.STRING(120), allowNull: true },
  externalRevision: { type: DataTypes.STRING(120), allowNull: true },
  gcsUri: { type: DataTypes.STRING(500), allowNull: true },
  ragFileName: { type: DataTypes.STRING(400), allowNull: true },
  importOperation: { type: DataTypes.STRING(400), allowNull: true },
  importAttempts: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  remoteCleanup: { type: DataTypes.ENUM('none', 'pending', 'done', 'error'), allowNull: false, defaultValue: 'none' },
  readyAt: { type: DataTypes.DATE, allowNull: true },
  textPurgedAt: { type: DataTypes.DATE, allowNull: true },
  createdBy: ref(true),
}, { tableName: 'source_versions', underscored: true });

// Relación entre una respuesta del tutor y la versión de la fuente que la respaldó.
export const AiMessageSource = sequelize.define('AiMessageSource', {
  id: id(),
  messageId: ref(),
  sourceId: ref(),
  sourceVersionId: ref(),
  courseId: ref(),
  position: { type: DataTypes.INTEGER, allowNull: false },
}, { tableName: 'ai_message_sources', underscored: true, updatedAt: false });

// Carpeta de Drive que la institución autoriza para sus cursos.
export const InstitutionDriveFolder = sequelize.define('InstitutionDriveFolder', {
  id: id(),
  institutionId: ref(),
  folderId: { type: DataTypes.STRING(128), allowNull: false },
  label: { type: DataTypes.STRING(180), allowNull: false },
  status: { type: DataTypes.ENUM('enabled', 'disabled'), allowNull: false, defaultValue: 'enabled' },
  createdBy: ref(true),
}, { tableName: 'institution_drive_folders', underscored: true });

// Vínculo de un curso con una carpeta y el avance de su sincronización.
export const CourseDriveLink = sequelize.define('CourseDriveLink', {
  id: id(),
  institutionId: ref(),
  courseId: ref(),
  driveFolderId: ref(),
  status: { type: DataTypes.ENUM('active', 'removed'), allowNull: false, defaultValue: 'active' },
  syncState: { type: DataTypes.ENUM('idle', 'running', 'interrupted', 'error'), allowNull: false, defaultValue: 'idle' },
  syncRunId: { type: DataTypes.STRING(36), allowNull: true },
  pageToken: { type: DataTypes.TEXT, allowNull: true },
  filesListed: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  lastSyncStartedAt: { type: DataTypes.DATE, allowNull: true },
  lastSyncCompletedAt: { type: DataTypes.DATE, allowNull: true },
  lastError: { type: DataTypes.STRING(500), allowNull: true },
  createdBy: ref(true),
}, { tableName: 'course_drive_links', underscored: true });

// Registro técnico de una consulta al tutor, sin contenido.
export const AiUsageEvent = sequelize.define('AiUsageEvent', {
  id: id(),
  institutionId: ref(),
  userId: ref(),
  courseId: ref(true),
  provider: { type: DataTypes.STRING(30), allowNull: true },
  model: { type: DataTypes.STRING(120), allowNull: true },
  retrievalMode: { type: DataTypes.STRING(20), allowNull: true },
  streamed: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  outcome: {
    type: DataTypes.ENUM('reserved', 'completed', 'no_evidence', 'no_citations', 'invalid_format', 'provider_error', 'retrieval_error', 'cancelled'),
    allowNull: false,
    defaultValue: 'reserved',
  },
  latencyMs: { type: DataTypes.INTEGER, allowNull: true },
  inputTokens: { type: DataTypes.INTEGER, allowNull: true },
  outputTokens: { type: DataTypes.INTEGER, allowNull: true },
}, { tableName: 'ai_usage_events', underscored: true });
