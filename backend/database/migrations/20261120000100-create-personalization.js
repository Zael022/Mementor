'use strict';

// Personalización: preferencias de la cuenta, repaso espaciado por tema y planes de estudio.
const fechas = (Sequelize) => ({
  created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
  updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
});
// PostgreSQL no tiene TINYINT: allí se usa SMALLINT (MySQL queda igual).
const pequeno = (queryInterface, Sequelize) => (queryInterface.sequelize.getDialect() === 'postgres' ? Sequelize.SMALLINT : Sequelize.TINYINT);
const id = (Sequelize) => ({ type: Sequelize.BIGINT.UNSIGNED, allowNull: false, primaryKey: true, autoIncrement: true });
const fk = (Sequelize, tabla, onDelete = 'CASCADE') => ({
  type: Sequelize.BIGINT.UNSIGNED,
  allowNull: false,
  references: { model: tabla, key: 'id' },
  onUpdate: 'CASCADE',
  onDelete,
});

module.exports = {
  async up(queryInterface, Sequelize) {
    // Una fila por persona; nace cuando guarda su primera preferencia.
    await queryInterface.createTable('user_preferences', {
      user_id: { ...fk(Sequelize, 'users'), primaryKey: true },
      theme: { type: Sequelize.ENUM('system', 'light', 'dark'), allowNull: false, defaultValue: 'system' },
      text_scale: { type: Sequelize.SMALLINT, allowNull: false, defaultValue: 100 },
      high_contrast: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      reduced_motion: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      reading_spacing: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      underline_links: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      time_zone: { type: Sequelize.STRING(64), allowNull: true },
      daily_goal_minutes: { type: Sequelize.SMALLINT, allowNull: true },
      practice_size: { type: pequeno(queryInterface, Sequelize), allowNull: false, defaultValue: 5 },
      ...fechas(Sequelize),
    });

    // Estado de memoria de cada tema para cada estudiante (algoritmo FSRS).
    await queryInterface.createTable('topic_reviews', {
      id: id(Sequelize),
      student_id: fk(Sequelize, 'users'),
      course_id: fk(Sequelize, 'courses'),
      topic_id: fk(Sequelize, 'topics'),
      stability: { type: Sequelize.DECIMAL(9, 3), allowNull: false },
      difficulty: { type: Sequelize.DECIMAL(5, 3), allowNull: false },
      due_at: { type: Sequelize.DATE, allowNull: false },
      last_reviewed_at: { type: Sequelize.DATE, allowNull: false },
      reps: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      lapses: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      last_grade: { type: pequeno(queryInterface, Sequelize), allowNull: false },
      algorithm_version: { type: Sequelize.STRING(40), allowNull: false },
      ...fechas(Sequelize),
    });
    await queryInterface.addIndex('topic_reviews', ['student_id', 'topic_id'], { unique: true, name: 'uq_topic_reviews_student_topic' });
    await queryInterface.addIndex('topic_reviews', ['student_id', 'course_id', 'due_at'], { name: 'ix_topic_reviews_due' });

    // Historial de cada repaso: de dónde salió la nota y qué intervalo se programó.
    await queryInterface.createTable('topic_review_logs', {
      id: id(Sequelize),
      review_id: fk(Sequelize, 'topic_reviews'),
      grade: { type: pequeno(queryInterface, Sequelize), allowNull: false },
      source: { type: Sequelize.ENUM('assessment', 'self'), allowNull: false },
      elapsed_days: { type: Sequelize.DECIMAL(9, 3), allowNull: false },
      scheduled_days: { type: Sequelize.INTEGER, allowNull: false },
      reviewed_at: { type: Sequelize.DATE, allowNull: false },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });
    await queryInterface.addIndex('topic_review_logs', ['review_id', 'reviewed_at'], { name: 'ix_topic_review_logs_review' });

    // Plan de estudio del estudiante en un curso (docs/06).
    await queryInterface.createTable('study_plans', {
      id: id(Sequelize),
      student_id: fk(Sequelize, 'users'),
      course_id: fk(Sequelize, 'courses'),
      title: { type: Sequelize.STRING(180), allowNull: false },
      start_date: { type: Sequelize.DATEONLY, allowNull: false },
      target_date: { type: Sequelize.DATEONLY, allowNull: false },
      minutes_per_session: { type: Sequelize.SMALLINT, allowNull: false },
      study_days: { type: Sequelize.STRING(20), allowNull: false },
      time_zone: { type: Sequelize.STRING(64), allowNull: false },
      unscheduled_minutes: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      status: { type: Sequelize.ENUM('active', 'archived'), allowNull: false, defaultValue: 'active' },
      algorithm_version: { type: Sequelize.STRING(40), allowNull: false },
      ...fechas(Sequelize),
    });
    await queryInterface.addIndex('study_plans', ['student_id', 'course_id', 'status'], { name: 'ix_study_plans_student_course' });

    await queryInterface.createTable('study_plan_items', {
      id: id(Sequelize),
      study_plan_id: fk(Sequelize, 'study_plans'),
      topic_id: fk(Sequelize, 'topics'),
      kind: { type: Sequelize.ENUM('learn', 'reinforce', 'practice', 'review'), allowNull: false },
      description: { type: Sequelize.STRING(300), allowNull: false },
      minutes: { type: Sequelize.SMALLINT, allowNull: false },
      scheduled_date: { type: Sequelize.DATEONLY, allowNull: false },
      position: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 1 },
      status: { type: Sequelize.ENUM('pending', 'done', 'skipped'), allowNull: false, defaultValue: 'pending' },
      ...fechas(Sequelize),
    });
    await queryInterface.addIndex('study_plan_items', ['study_plan_id', 'scheduled_date'], { name: 'ix_study_plan_items_plan_date' });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('study_plan_items', {});
    await queryInterface.dropTable('study_plans', {});
    await queryInterface.dropTable('topic_review_logs', {});
    await queryInterface.dropTable('topic_reviews', {});
    await queryInterface.dropTable('user_preferences', {});
  },
};
