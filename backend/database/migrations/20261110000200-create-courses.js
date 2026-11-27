'use strict';

// Crea la estructura académica: cursos, matrículas, módulos, temas y lecciones.
const fechas = (Sequelize) => ({
  created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
  updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
});
const id = (Sequelize) => ({ type: Sequelize.BIGINT.UNSIGNED, allowNull: false, primaryKey: true, autoIncrement: true });
const fk = (Sequelize, tabla, onDelete = 'RESTRICT') => ({
  type: Sequelize.BIGINT.UNSIGNED,
  allowNull: false,
  references: { model: tabla, key: 'id' },
  onUpdate: 'CASCADE',
  onDelete,
});

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('courses', {
      id: id(Sequelize),
      institution_id: fk(Sequelize, 'institutions'),
      code: { type: Sequelize.STRING(40), allowNull: false },
      title: { type: Sequelize.STRING(180), allowNull: false },
      description: { type: Sequelize.TEXT, allowNull: true },
      status: { type: Sequelize.ENUM('draft', 'published', 'archived'), allowNull: false, defaultValue: 'draft' },
      created_by: fk(Sequelize, 'users'),
      ...fechas(Sequelize),
    });
    await queryInterface.addIndex('courses', ['institution_id', 'code'], { unique: true, name: 'uq_courses_institution_code' });
    await queryInterface.addIndex('courses', ['institution_id', 'status'], { name: 'ix_courses_institution_status' });

    await queryInterface.createTable('course_teachers', {
      course_id: { ...fk(Sequelize, 'courses', 'CASCADE'), primaryKey: true },
      user_id: { ...fk(Sequelize, 'users'), primaryKey: true },
      ...fechas(Sequelize),
    });

    await queryInterface.createTable('enrollments', {
      id: id(Sequelize),
      course_id: fk(Sequelize, 'courses', 'CASCADE'),
      student_id: fk(Sequelize, 'users'),
      status: { type: Sequelize.ENUM('active', 'withdrawn'), allowNull: false, defaultValue: 'active' },
      ...fechas(Sequelize),
    });
    await queryInterface.addIndex('enrollments', ['course_id', 'student_id'], { unique: true, name: 'uq_enrollments_course_student' });
    await queryInterface.addIndex('enrollments', ['student_id', 'status'], { name: 'ix_enrollments_student_status' });

    await queryInterface.createTable('modules', {
      id: id(Sequelize),
      course_id: fk(Sequelize, 'courses', 'CASCADE'),
      title: { type: Sequelize.STRING(180), allowNull: false },
      position: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 1 },
      ...fechas(Sequelize),
    });

    await queryInterface.createTable('topics', {
      id: id(Sequelize),
      course_id: fk(Sequelize, 'courses', 'CASCADE'),
      module_id: fk(Sequelize, 'modules'),
      title: { type: Sequelize.STRING(180), allowNull: false },
      learning_objective: { type: Sequelize.STRING(500), allowNull: true },
      position: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 1 },
      ...fechas(Sequelize),
    });

    await queryInterface.createTable('topic_prerequisites', {
      topic_id: { ...fk(Sequelize, 'topics', 'CASCADE'), primaryKey: true },
      prerequisite_topic_id: { ...fk(Sequelize, 'topics', 'CASCADE'), primaryKey: true },
      ...fechas(Sequelize),
    });

    await queryInterface.createTable('lessons', {
      id: id(Sequelize),
      course_id: fk(Sequelize, 'courses', 'CASCADE'),
      topic_id: fk(Sequelize, 'topics'),
      title: { type: Sequelize.STRING(180), allowNull: false },
      body_md: { type: Sequelize.TEXT('medium'), allowNull: false },
      status: { type: Sequelize.ENUM('draft', 'published'), allowNull: false, defaultValue: 'draft' },
      position: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 1 },
      ...fechas(Sequelize),
    });
    await queryInterface.addIndex('lessons', ['course_id', 'status'], { name: 'ix_lessons_course_status' });

    await queryInterface.createTable('lesson_progress', {
      id: id(Sequelize),
      student_id: fk(Sequelize, 'users'),
      lesson_id: fk(Sequelize, 'lessons', 'CASCADE'),
      status: { type: Sequelize.ENUM('completed'), allowNull: false, defaultValue: 'completed' },
      completed_at: { type: Sequelize.DATE, allowNull: false },
      ...fechas(Sequelize),
    });
    await queryInterface.addIndex('lesson_progress', ['student_id', 'lesson_id'], { unique: true, name: 'uq_lesson_progress_student_lesson' });
  },

  async down(queryInterface) {
    for (const tabla of ['lesson_progress', 'lessons', 'topic_prerequisites', 'topics', 'modules', 'enrollments', 'course_teachers', 'courses']) {
      await queryInterface.dropTable(tabla, {});
    }
  },
};
