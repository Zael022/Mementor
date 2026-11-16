import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

// Representa un curso de una institución.
export const Course = sequelize.define('Course', {
  id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
  institutionId: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
  code: { type: DataTypes.STRING(40), allowNull: false },
  title: { type: DataTypes.STRING(180), allowNull: false },
  description: { type: DataTypes.TEXT, allowNull: true },
  status: { type: DataTypes.ENUM('draft', 'published', 'archived'), allowNull: false, defaultValue: 'draft' },
  createdBy: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
}, { tableName: 'courses', underscored: true });

// Relaciona docentes con sus cursos.
export const CourseTeacher = sequelize.define('CourseTeacher', {
  courseId: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true },
  userId: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true },
}, { tableName: 'course_teachers', underscored: true });

// Registra la matrícula de un estudiante.
export const Enrollment = sequelize.define('Enrollment', {
  id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
  courseId: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
  studentId: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
  status: { type: DataTypes.ENUM('active', 'withdrawn'), allowNull: false, defaultValue: 'active' },
}, { tableName: 'enrollments', underscored: true });
