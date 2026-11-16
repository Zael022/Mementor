import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

// Cada atributo necesita su propio objeto de definición.
const id = () => ({ type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true });
const ref = () => ({ type: DataTypes.BIGINT.UNSIGNED, allowNull: false });

// Agrupa los temas de un curso.
export const Module = sequelize.define('Module', {
  id: id(),
  courseId: ref(),
  title: { type: DataTypes.STRING(180), allowNull: false },
  position: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
}, { tableName: 'modules', underscored: true });

// Representa un tema con su objetivo de aprendizaje.
export const Topic = sequelize.define('Topic', {
  id: id(),
  courseId: ref(),
  moduleId: ref(),
  title: { type: DataTypes.STRING(180), allowNull: false },
  learningObjective: { type: DataTypes.STRING(500), allowNull: true },
  position: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
}, { tableName: 'topics', underscored: true });

// Indica qué tema se debe dominar antes de otro.
export const TopicPrerequisite = sequelize.define('TopicPrerequisite', {
  topicId: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true },
  prerequisiteTopicId: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true },
}, { tableName: 'topic_prerequisites', underscored: true });

// Guarda el contenido de una lección en Markdown.
export const Lesson = sequelize.define('Lesson', {
  id: id(),
  courseId: ref(),
  topicId: ref(),
  title: { type: DataTypes.STRING(180), allowNull: false },
  bodyMd: { type: DataTypes.TEXT('medium'), allowNull: false },
  videoUrl: { type: DataTypes.STRING(500), allowNull: true },
  status: { type: DataTypes.ENUM('draft', 'published'), allowNull: false, defaultValue: 'draft' },
  position: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
}, { tableName: 'lessons', underscored: true });

// Registra las lecciones completadas por cada estudiante.
export const LessonProgress = sequelize.define('LessonProgress', {
  id: id(),
  studentId: ref(),
  lessonId: ref(),
  status: { type: DataTypes.ENUM('completed'), allowNull: false, defaultValue: 'completed' },
  completedAt: { type: DataTypes.DATE, allowNull: false },
}, { tableName: 'lesson_progress', underscored: true });
