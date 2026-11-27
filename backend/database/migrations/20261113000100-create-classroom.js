'use strict';

// Crea las tablas del aula: clases en vivo, asistencia, anuncios, materiales, comentarios y tareas.
const fechas = (Sequelize) => ({
  created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
  updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
});
const id = (Sequelize) => ({ type: Sequelize.BIGINT.UNSIGNED, allowNull: false, primaryKey: true, autoIncrement: true });
const fk = (Sequelize, tabla, onDelete = 'RESTRICT', allowNull = false) => ({
  type: Sequelize.BIGINT.UNSIGNED,
  allowNull,
  references: { model: tabla, key: 'id' },
  onUpdate: 'CASCADE',
  onDelete,
});

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('lessons', 'video_url', { type: Sequelize.STRING(500), allowNull: true });

    await queryInterface.createTable('class_sessions', {
      id: id(Sequelize),
      course_id: fk(Sequelize, 'courses', 'CASCADE'),
      topic_id: fk(Sequelize, 'topics', 'SET NULL', true),
      title: { type: Sequelize.STRING(180), allowNull: false },
      description: { type: Sequelize.TEXT, allowNull: true },
      starts_at: { type: Sequelize.DATE, allowNull: false },
      duration_minutes: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 60 },
      meeting_url: { type: Sequelize.STRING(500), allowNull: false },
      recording_url: { type: Sequelize.STRING(500), allowNull: true },
      status: { type: Sequelize.ENUM('scheduled', 'cancelled'), allowNull: false, defaultValue: 'scheduled' },
      created_by: fk(Sequelize, 'users'),
      ...fechas(Sequelize),
    });
    await queryInterface.addIndex('class_sessions', ['course_id', 'starts_at'], { name: 'ix_sessions_course_start' });

    await queryInterface.createTable('session_attendance', {
      id: id(Sequelize),
      session_id: fk(Sequelize, 'class_sessions', 'CASCADE'),
      student_id: fk(Sequelize, 'users'),
      joined_at: { type: Sequelize.DATE, allowNull: false },
      ...fechas(Sequelize),
    });
    await queryInterface.addIndex('session_attendance', ['session_id', 'student_id'], { unique: true, name: 'uq_attendance_session_student' });

    await queryInterface.createTable('announcements', {
      id: id(Sequelize),
      course_id: fk(Sequelize, 'courses', 'CASCADE'),
      author_id: fk(Sequelize, 'users'),
      title: { type: Sequelize.STRING(180), allowNull: false },
      body: { type: Sequelize.TEXT, allowNull: false },
      ...fechas(Sequelize),
    });
    await queryInterface.addIndex('announcements', ['course_id', 'created_at'], { name: 'ix_announcements_course_created' });

    await queryInterface.createTable('materials', {
      id: id(Sequelize),
      course_id: fk(Sequelize, 'courses', 'CASCADE'),
      lesson_id: fk(Sequelize, 'lessons', 'CASCADE', true),
      title: { type: Sequelize.STRING(180), allowNull: false },
      kind: { type: Sequelize.ENUM('link', 'file'), allowNull: false },
      url: { type: Sequelize.STRING(500), allowNull: true },
      file_name: { type: Sequelize.STRING(200), allowNull: true },
      stored_name: { type: Sequelize.STRING(120), allowNull: true },
      mime_type: { type: Sequelize.STRING(120), allowNull: true },
      size_bytes: { type: Sequelize.INTEGER, allowNull: true },
      uploaded_by: fk(Sequelize, 'users'),
      ...fechas(Sequelize),
    });
    await queryInterface.addIndex('materials', ['course_id', 'lesson_id'], { name: 'ix_materials_course_lesson' });

    await queryInterface.createTable('lesson_comments', {
      id: id(Sequelize),
      course_id: fk(Sequelize, 'courses', 'CASCADE'),
      lesson_id: fk(Sequelize, 'lessons', 'CASCADE'),
      author_id: fk(Sequelize, 'users'),
      parent_id: fk(Sequelize, 'lesson_comments', 'CASCADE', true),
      body: { type: Sequelize.TEXT, allowNull: false },
      ...fechas(Sequelize),
    });
    await queryInterface.addIndex('lesson_comments', ['lesson_id', 'created_at'], { name: 'ix_comments_lesson_created' });

    await queryInterface.createTable('assignments', {
      id: id(Sequelize),
      course_id: fk(Sequelize, 'courses', 'CASCADE'),
      topic_id: fk(Sequelize, 'topics', 'SET NULL', true),
      title: { type: Sequelize.STRING(180), allowNull: false },
      instructions: { type: Sequelize.TEXT, allowNull: false },
      due_at: { type: Sequelize.DATE, allowNull: true },
      max_points: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 100 },
      status: { type: Sequelize.ENUM('draft', 'published'), allowNull: false, defaultValue: 'draft' },
      ...fechas(Sequelize),
    });
    await queryInterface.addIndex('assignments', ['course_id', 'status'], { name: 'ix_assignments_course_status' });

    await queryInterface.createTable('assignment_submissions', {
      id: id(Sequelize),
      assignment_id: fk(Sequelize, 'assignments'),
      student_id: fk(Sequelize, 'users'),
      body: { type: Sequelize.TEXT, allowNull: false },
      link_url: { type: Sequelize.STRING(500), allowNull: true },
      submitted_at: { type: Sequelize.DATE, allowNull: false },
      grade_points: { type: Sequelize.INTEGER, allowNull: true },
      feedback: { type: Sequelize.TEXT, allowNull: true },
      graded_by: fk(Sequelize, 'users', 'SET NULL', true),
      graded_at: { type: Sequelize.DATE, allowNull: true },
      ...fechas(Sequelize),
    });
    await queryInterface.addIndex('assignment_submissions', ['assignment_id', 'student_id'], { unique: true, name: 'uq_submissions_assignment_student' });
  },

  async down(queryInterface) {
    for (const tabla of ['assignment_submissions', 'assignments', 'lesson_comments', 'materials', 'announcements', 'session_attendance', 'class_sessions']) {
      await queryInterface.dropTable(tabla, {});
    }
    await queryInterface.removeColumn('lessons', 'video_url');
  },
};
