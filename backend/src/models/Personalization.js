import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

// Cada atributo necesita su propio objeto de definición.
const id = () => ({ type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true });
const ref = () => ({ type: DataTypes.BIGINT.UNSIGNED, allowNull: false });

// Preferencias de apariencia, accesibilidad y metas de estudio de cada persona.
export const UserPreference = sequelize.define('UserPreference', {
  userId: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true },
  theme: { type: DataTypes.ENUM('system', 'light', 'dark'), allowNull: false, defaultValue: 'system' },
  textScale: { type: DataTypes.SMALLINT, allowNull: false, defaultValue: 100 },
  highContrast: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  reducedMotion: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  readingSpacing: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  underlineLinks: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  timeZone: { type: DataTypes.STRING(64), allowNull: true },
  dailyGoalMinutes: { type: DataTypes.SMALLINT, allowNull: true },
  practiceSize: { type: DataTypes.TINYINT, allowNull: false, defaultValue: 5 },
  emailReminders: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
  showMascots: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
  showBigCelebrations: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
  // Pausa paseante: si puede pasear y el día local en que la persona la escondió «por hoy».
  pausaWalks: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
  pausaHiddenOn: { type: DataTypes.DATEONLY, allowNull: true },
}, { tableName: 'user_preferences', underscored: true });

// Estado de memoria de un tema para un estudiante (repaso espaciado).
export const TopicReview = sequelize.define('TopicReview', {
  id: id(),
  studentId: ref(),
  courseId: ref(),
  topicId: ref(),
  stability: { type: DataTypes.DECIMAL(9, 3), allowNull: false },
  difficulty: { type: DataTypes.DECIMAL(5, 3), allowNull: false },
  dueAt: { type: DataTypes.DATE, allowNull: false },
  lastReviewedAt: { type: DataTypes.DATE, allowNull: false },
  reps: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  lapses: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  lastGrade: { type: DataTypes.TINYINT, allowNull: false },
  algorithmVersion: { type: DataTypes.STRING(40), allowNull: false },
}, { tableName: 'topic_reviews', underscored: true });

// Historial de repasos con el origen de la nota.
export const TopicReviewLog = sequelize.define('TopicReviewLog', {
  id: id(),
  reviewId: ref(),
  grade: { type: DataTypes.TINYINT, allowNull: false },
  source: { type: DataTypes.ENUM('assessment', 'self'), allowNull: false },
  elapsedDays: { type: DataTypes.DECIMAL(9, 3), allowNull: false },
  scheduledDays: { type: DataTypes.INTEGER, allowNull: false },
  reviewedAt: { type: DataTypes.DATE, allowNull: false },
}, { tableName: 'topic_review_logs', underscored: true, updatedAt: false });

// Plan de estudio de un estudiante en un curso.
export const StudyPlan = sequelize.define('StudyPlan', {
  id: id(),
  studentId: ref(),
  courseId: ref(),
  title: { type: DataTypes.STRING(180), allowNull: false },
  startDate: { type: DataTypes.DATEONLY, allowNull: false },
  targetDate: { type: DataTypes.DATEONLY, allowNull: false },
  minutesPerSession: { type: DataTypes.SMALLINT, allowNull: false },
  studyDays: { type: DataTypes.STRING(20), allowNull: false },
  timeZone: { type: DataTypes.STRING(64), allowNull: false },
  unscheduledMinutes: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  status: { type: DataTypes.ENUM('active', 'archived'), allowNull: false, defaultValue: 'active' },
  algorithmVersion: { type: DataTypes.STRING(40), allowNull: false },
}, { tableName: 'study_plans', underscored: true });

// Sesión de estudio dentro del plan.
export const StudyPlanItem = sequelize.define('StudyPlanItem', {
  id: id(),
  studyPlanId: ref(),
  topicId: ref(),
  kind: { type: DataTypes.ENUM('learn', 'reinforce', 'practice', 'review'), allowNull: false },
  description: { type: DataTypes.STRING(300), allowNull: false },
  minutes: { type: DataTypes.SMALLINT, allowNull: false },
  scheduledDate: { type: DataTypes.DATEONLY, allowNull: false },
  position: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
  status: { type: DataTypes.ENUM('pending', 'done', 'skipped'), allowNull: false, defaultValue: 'pending' },
}, { tableName: 'study_plan_items', underscored: true });
