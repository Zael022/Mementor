import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

// Cada atributo necesita su propio objeto de definición.
const id = () => ({ type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true });
const ref = () => ({ type: DataTypes.BIGINT.UNSIGNED, allowNull: false });

// Representa un cuestionario de un curso.
export const Assessment = sequelize.define('Assessment', {
  id: id(),
  courseId: ref(),
  topicId: ref(),
  title: { type: DataTypes.STRING(180), allowNull: false },
  status: { type: DataTypes.ENUM('draft', 'published', 'closed'), allowNull: false, defaultValue: 'draft' },
  passingScore: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 60 },
  maxAttempts: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 3 },
}, { tableName: 'assessments', underscored: true });

// Representa una pregunta de opción múltiple.
export const Question = sequelize.define('Question', {
  id: id(),
  assessmentId: ref(),
  topicId: ref(),
  stem: { type: DataTypes.TEXT, allowNull: false },
  explanation: { type: DataTypes.TEXT, allowNull: true },
  points: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
  position: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
}, { tableName: 'questions', underscored: true });

// Guarda cada opción; la clave correcta nunca sale del backend antes de tiempo.
export const QuestionOption = sequelize.define('QuestionOption', {
  id: id(),
  questionId: ref(),
  body: { type: DataTypes.STRING(500), allowNull: false },
  isCorrect: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  position: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
}, { tableName: 'question_options', underscored: true });

// Registra cada intento de un estudiante.
export const AssessmentAttempt = sequelize.define('AssessmentAttempt', {
  id: id(),
  assessmentId: ref(),
  studentId: ref(),
  status: { type: DataTypes.ENUM('in_progress', 'submitted'), allowNull: false, defaultValue: 'in_progress' },
  scorePct: { type: DataTypes.DECIMAL(5, 2), allowNull: true },
  earnedPoints: { type: DataTypes.INTEGER, allowNull: true },
  totalPoints: { type: DataTypes.INTEGER, allowNull: true },
  submittedAt: { type: DataTypes.DATE, allowNull: true },
}, { tableName: 'assessment_attempts', underscored: true });

// Guarda la respuesta dada a cada pregunta.
export const AttemptAnswer = sequelize.define('AttemptAnswer', {
  id: id(),
  attemptId: ref(),
  questionId: ref(),
  selectedOptionId: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true },
  isCorrect: { type: DataTypes.BOOLEAN, allowNull: false },
  earnedPoints: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
}, { tableName: 'attempt_answers', underscored: true });
