import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

// Cada atributo necesita su propio objeto de definición.
const id = () => ({ type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true });
const ref = (allowNull = false) => ({ type: DataTypes.BIGINT.UNSIGNED, allowNull });
// Los DECIMAL de MySQL llegan como texto; los servicios los convierten con Number().
const decimal = (precision, scale, defaultValue) => ({ type: DataTypes.DECIMAL(precision, scale), allowNull: false, defaultValue });

// Pesos de la nota final y valores del bono de un curso.
export const CourseGradePolicy = sequelize.define('CourseGradePolicy', {
  courseId: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true },
  assessmentsWeight: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 40 },
  assignmentsWeight: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 30 },
  classworkWeight: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 30 },
  quizBonus: decimal(4, 2, 0.1),
  streakDayBonus: decimal(4, 2, 0.09),
  bonusCap: decimal(4, 2, 1),
}, { tableName: 'course_grade_policies', underscored: true });

// Actividad de trabajo en clase (participación, práctica guiada, exposición…).
export const ClassWorkItem = sequelize.define('ClassWorkItem', {
  id: id(),
  courseId: ref(),
  title: { type: DataTypes.STRING(180), allowNull: false },
  maxPoints: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 100 },
  workDate: { type: DataTypes.DATEONLY, allowNull: true },
  createdBy: ref(),
}, { tableName: 'class_work_items', underscored: true });

// Calificación que el docente pone a un estudiante en una actividad.
export const ClassWorkGrade = sequelize.define('ClassWorkGrade', {
  id: id(),
  itemId: ref(),
  studentId: ref(),
  points: { type: DataTypes.DECIMAL(6, 2), allowNull: false },
  feedback: { type: DataTypes.STRING(1000), allowNull: true },
  gradedBy: ref(),
}, { tableName: 'class_work_grades', underscored: true });

// Quiz rápido con tiempo por pregunta.
export const QuickQuiz = sequelize.define('QuickQuiz', {
  id: id(),
  courseId: ref(),
  title: { type: DataTypes.STRING(180), allowNull: false },
  status: { type: DataTypes.ENUM('draft', 'published', 'archived'), allowNull: false, defaultValue: 'draft' },
  secondsPerQuestion: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 20 },
  createdBy: ref(),
}, { tableName: 'quick_quizzes', underscored: true });

// Pregunta del quiz; también forma el banco de la práctica diaria.
export const QuickQuizQuestion = sequelize.define('QuickQuizQuestion', {
  id: id(),
  quizId: ref(),
  prompt: { type: DataTypes.STRING(500), allowNull: false },
  position: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
}, { tableName: 'quick_quiz_questions', underscored: true });

// Opción de respuesta; la correcta nunca se envía antes de responder.
export const QuickQuizOption = sequelize.define('QuickQuizOption', {
  id: id(),
  questionId: ref(),
  body: { type: DataTypes.STRING(200), allowNull: false },
  isCorrect: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  position: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
}, { tableName: 'quick_quiz_options', underscored: true });

// Partida de un estudiante.
export const QuizPlay = sequelize.define('QuizPlay', {
  id: id(),
  quizId: ref(),
  studentId: ref(),
  status: { type: DataTypes.ENUM('in_progress', 'finished'), allowNull: false, defaultValue: 'in_progress' },
  totalQuestions: { type: DataTypes.INTEGER, allowNull: false },
  correctCount: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  score: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  perfect: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  finishedAt: { type: DataTypes.DATE, allowNull: true },
}, { tableName: 'quiz_plays', underscored: true });

// Momento en que se mostró cada pregunta y lo que se respondió.
export const QuizPlayAnswer = sequelize.define('QuizPlayAnswer', {
  id: id(),
  playId: ref(),
  questionId: ref(),
  optionId: ref(true),
  shownAt: { type: DataTypes.DATE(3), allowNull: false },
  answeredAt: { type: DataTypes.DATE(3), allowNull: true },
  isCorrect: { type: DataTypes.BOOLEAN, allowNull: true },
  points: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
}, { tableName: 'quiz_play_answers', underscored: true });

// Práctica diaria de un estudiante en un curso.
export const DailyPractice = sequelize.define('DailyPractice', {
  id: id(),
  courseId: ref(),
  studentId: ref(),
  practiceDay: { type: DataTypes.DATEONLY, allowNull: false },
  questionIds: { type: DataTypes.JSON, allowNull: false },
  answeredCount: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  completedAt: { type: DataTypes.DATE, allowNull: true },
}, { tableName: 'daily_practices', underscored: true });

export const DailyPracticeAnswer = sequelize.define('DailyPracticeAnswer', {
  id: id(),
  practiceId: ref(),
  questionId: ref(),
  optionId: ref(true),
  isCorrect: { type: DataTypes.BOOLEAN, allowNull: false },
}, { tableName: 'daily_practice_answers', underscored: true });

// Racha actual y mejor racha por curso.
export const CourseStreak = sequelize.define('CourseStreak', {
  id: id(),
  courseId: ref(),
  studentId: ref(),
  currentDays: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  bestDays: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  lastDay: { type: DataTypes.DATEONLY, allowNull: true },
}, { tableName: 'course_streaks', underscored: true });

// Punto de bono ganado (quiz perfecto o día de racha).
export const GradeBonusEvent = sequelize.define('GradeBonusEvent', {
  id: id(),
  courseId: ref(),
  studentId: ref(),
  kind: { type: DataTypes.ENUM('quiz', 'streak_day'), allowNull: false },
  reference: { type: DataTypes.STRING(40), allowNull: false },
  amount: { type: DataTypes.DECIMAL(5, 2), allowNull: false },
}, { tableName: 'grade_bonus_events', underscored: true });

// Partida de Parejas (práctica sin nota ni bono). El tablero con las parejas nunca sale completo del servidor.
export const MemoryGame = sequelize.define('MemoryGame', {
  id: id(),
  institutionId: ref(),
  courseId: ref(),
  moduleId: ref(),
  studentId: ref(),
  status: { type: DataTypes.ENUM('in_progress', 'finished'), allowNull: false, defaultValue: 'in_progress' },
  pairCount: { type: DataTypes.TINYINT.UNSIGNED, allowNull: false },
  board: { type: DataTypes.JSON, allowNull: false },
  matchedPairs: { type: DataTypes.TINYINT.UNSIGNED, allowNull: false, defaultValue: 0 },
  attempts: { type: DataTypes.SMALLINT.UNSIGNED, allowNull: false, defaultValue: 0 },
  startedAt: { type: DataTypes.DATE(3), allowNull: false },
  finishedAt: { type: DataTypes.DATE(3), allowNull: true },
}, { tableName: 'memory_games', underscored: true });
