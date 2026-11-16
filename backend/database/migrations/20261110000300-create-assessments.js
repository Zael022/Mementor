'use strict';

// Crea evaluaciones, preguntas, intentos y respuestas.
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
    await queryInterface.createTable('assessments', {
      id: id(Sequelize),
      course_id: fk(Sequelize, 'courses', 'CASCADE'),
      topic_id: fk(Sequelize, 'topics'),
      title: { type: Sequelize.STRING(180), allowNull: false },
      status: { type: Sequelize.ENUM('draft', 'published', 'closed'), allowNull: false, defaultValue: 'draft' },
      passing_score: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 60 },
      max_attempts: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 3 },
      ...fechas(Sequelize),
    });
    await queryInterface.addIndex('assessments', ['course_id', 'status'], { name: 'ix_assessments_course_status' });

    await queryInterface.createTable('questions', {
      id: id(Sequelize),
      assessment_id: fk(Sequelize, 'assessments', 'CASCADE'),
      topic_id: fk(Sequelize, 'topics'),
      stem: { type: Sequelize.TEXT, allowNull: false },
      explanation: { type: Sequelize.TEXT, allowNull: true },
      points: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 1 },
      position: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 1 },
      ...fechas(Sequelize),
    });

    await queryInterface.createTable('question_options', {
      id: id(Sequelize),
      question_id: fk(Sequelize, 'questions', 'CASCADE'),
      body: { type: Sequelize.STRING(500), allowNull: false },
      is_correct: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      position: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 1 },
      ...fechas(Sequelize),
    });

    await queryInterface.createTable('assessment_attempts', {
      id: id(Sequelize),
      assessment_id: fk(Sequelize, 'assessments'),
      student_id: fk(Sequelize, 'users'),
      status: { type: Sequelize.ENUM('in_progress', 'submitted'), allowNull: false, defaultValue: 'in_progress' },
      score_pct: { type: Sequelize.DECIMAL(5, 2), allowNull: true },
      earned_points: { type: Sequelize.INTEGER, allowNull: true },
      total_points: { type: Sequelize.INTEGER, allowNull: true },
      submitted_at: { type: Sequelize.DATE, allowNull: true },
      ...fechas(Sequelize),
    });
    await queryInterface.addIndex('assessment_attempts', ['assessment_id', 'student_id'], { name: 'ix_attempts_assessment_student' });
    await queryInterface.addIndex('assessment_attempts', ['student_id', 'status'], { name: 'ix_attempts_student_status' });

    await queryInterface.createTable('attempt_answers', {
      id: id(Sequelize),
      attempt_id: fk(Sequelize, 'assessment_attempts', 'CASCADE'),
      question_id: fk(Sequelize, 'questions'),
      selected_option_id: fk(Sequelize, 'question_options', 'RESTRICT', true),
      is_correct: { type: Sequelize.BOOLEAN, allowNull: false },
      earned_points: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      ...fechas(Sequelize),
    });
    await queryInterface.addIndex('attempt_answers', ['attempt_id', 'question_id'], { unique: true, name: 'uq_answers_attempt_question' });
  },

  async down(queryInterface) {
    for (const tabla of ['attempt_answers', 'assessment_attempts', 'question_options', 'questions', 'assessments']) {
      await queryInterface.dropTable(tabla);
    }
  },
};
