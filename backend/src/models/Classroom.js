import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

// Cada atributo necesita su propio objeto de definición.
const id = () => ({ type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true });
const ref = (allowNull = false) => ({ type: DataTypes.BIGINT.UNSIGNED, allowNull });

// Representa una clase en vivo programada.
export const ClassSession = sequelize.define('ClassSession', {
  id: id(),
  courseId: ref(),
  topicId: ref(true),
  title: { type: DataTypes.STRING(180), allowNull: false },
  description: { type: DataTypes.TEXT, allowNull: true },
  startsAt: { type: DataTypes.DATE, allowNull: false },
  durationMinutes: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 60 },
  meetingUrl: { type: DataTypes.STRING(500), allowNull: false },
  recordingUrl: { type: DataTypes.STRING(500), allowNull: true },
  status: { type: DataTypes.ENUM('scheduled', 'cancelled'), allowNull: false, defaultValue: 'scheduled' },
  createdBy: ref(),
}, { tableName: 'class_sessions', underscored: true });

// Registra que un estudiante entró a una clase.
export const SessionAttendance = sequelize.define('SessionAttendance', {
  id: id(),
  sessionId: ref(),
  studentId: ref(),
  joinedAt: { type: DataTypes.DATE, allowNull: false },
}, { tableName: 'session_attendance', underscored: true });

// Aviso publicado por el docente en un curso.
export const Announcement = sequelize.define('Announcement', {
  id: id(),
  courseId: ref(),
  authorId: ref(),
  title: { type: DataTypes.STRING(180), allowNull: false },
  body: { type: DataTypes.TEXT, allowNull: false },
}, { tableName: 'announcements', underscored: true });

// Recurso del curso o de una lección: enlace o archivo.
export const Material = sequelize.define('Material', {
  id: id(),
  courseId: ref(),
  lessonId: ref(true),
  title: { type: DataTypes.STRING(180), allowNull: false },
  kind: { type: DataTypes.ENUM('link', 'file'), allowNull: false },
  url: { type: DataTypes.STRING(500), allowNull: true },
  fileName: { type: DataTypes.STRING(200), allowNull: true },
  storedName: { type: DataTypes.STRING(120), allowNull: true },
  mimeType: { type: DataTypes.STRING(120), allowNull: true },
  sizeBytes: { type: DataTypes.INTEGER, allowNull: true },
  contentSha256: { type: DataTypes.CHAR(64), allowNull: true },
  uploadedBy: ref(),
}, { tableName: 'materials', underscored: true });

// Pregunta o respuesta escrita en una lección.
export const LessonComment = sequelize.define('LessonComment', {
  id: id(),
  courseId: ref(),
  lessonId: ref(),
  authorId: ref(),
  parentId: ref(true),
  body: { type: DataTypes.TEXT, allowNull: false },
}, { tableName: 'lesson_comments', underscored: true });

// Tarea asignada por el docente.
export const Assignment = sequelize.define('Assignment', {
  id: id(),
  courseId: ref(),
  topicId: ref(true),
  title: { type: DataTypes.STRING(180), allowNull: false },
  instructions: { type: DataTypes.TEXT, allowNull: false },
  dueAt: { type: DataTypes.DATE, allowNull: true },
  maxPoints: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 100 },
  status: { type: DataTypes.ENUM('draft', 'published'), allowNull: false, defaultValue: 'draft' },
}, { tableName: 'assignments', underscored: true });

// Entrega de un estudiante con su nota y retroalimentación.
export const AssignmentSubmission = sequelize.define('AssignmentSubmission', {
  id: id(),
  assignmentId: ref(),
  studentId: ref(),
  body: { type: DataTypes.TEXT, allowNull: false },
  linkUrl: { type: DataTypes.STRING(500), allowNull: true },
  submittedAt: { type: DataTypes.DATE, allowNull: false },
  gradePoints: { type: DataTypes.INTEGER, allowNull: true },
  feedback: { type: DataTypes.TEXT, allowNull: true },
  gradedBy: ref(true),
  gradedAt: { type: DataTypes.DATE, allowNull: true },
}, { tableName: 'assignment_submissions', underscored: true });
