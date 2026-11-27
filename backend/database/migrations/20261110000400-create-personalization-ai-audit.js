'use strict';

// Crea dominio por tema, recomendaciones, tutor IA y auditoría.
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
    await queryInterface.createTable('topic_mastery', {
      id: id(Sequelize),
      student_id: fk(Sequelize, 'users'),
      topic_id: fk(Sequelize, 'topics', 'CASCADE'),
      mastery_score: { type: Sequelize.DECIMAL(4, 3), allowNull: false },
      evidence_count: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      algorithm_version: { type: Sequelize.STRING(40), allowNull: false },
      ...fechas(Sequelize),
    });
    await queryInterface.addIndex('topic_mastery', ['topic_id', 'student_id'], { unique: true, name: 'uq_mastery_topic_student' });

    await queryInterface.createTable('learning_recommendations', {
      id: id(Sequelize),
      student_id: fk(Sequelize, 'users'),
      course_id: fk(Sequelize, 'courses', 'CASCADE'),
      topic_id: fk(Sequelize, 'topics', 'CASCADE'),
      next_topic_id: fk(Sequelize, 'topics', 'SET NULL', true),
      type: { type: Sequelize.ENUM('reinforce', 'practice', 'advance'), allowNull: false },
      reason: { type: Sequelize.STRING(500), allowNull: false },
      status: { type: Sequelize.ENUM('active', 'replaced', 'dismissed'), allowNull: false, defaultValue: 'active' },
      ...fechas(Sequelize),
    });
    await queryInterface.addIndex('learning_recommendations', ['student_id', 'status'], { name: 'ix_recommendations_student_status' });

    await queryInterface.createTable('ai_threads', {
      id: id(Sequelize),
      user_id: fk(Sequelize, 'users'),
      course_id: fk(Sequelize, 'courses', 'CASCADE'),
      title: { type: Sequelize.STRING(180), allowNull: false },
      ...fechas(Sequelize),
    });

    await queryInterface.createTable('ai_messages', {
      id: id(Sequelize),
      thread_id: fk(Sequelize, 'ai_threads', 'CASCADE'),
      role: { type: Sequelize.ENUM('user', 'assistant'), allowNull: false },
      content: { type: Sequelize.TEXT, allowNull: false },
      citations_json: { type: Sequelize.JSON, allowNull: true },
      grounded: { type: Sequelize.BOOLEAN, allowNull: true },
      model: { type: Sequelize.STRING(120), allowNull: true },
      ...fechas(Sequelize),
    });

    await queryInterface.createTable('audit_logs', {
      id: id(Sequelize),
      institution_id: fk(Sequelize, 'institutions', 'RESTRICT', true),
      actor_id: fk(Sequelize, 'users', 'SET NULL', true),
      action: { type: Sequelize.STRING(80), allowNull: false },
      resource_type: { type: Sequelize.STRING(60), allowNull: false },
      resource_id: { type: Sequelize.BIGINT.UNSIGNED, allowNull: true },
      metadata_json: { type: Sequelize.JSON, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });
    await queryInterface.addIndex('audit_logs', ['institution_id', 'created_at'], { name: 'ix_audit_institution_created' });
  },

  async down(queryInterface) {
    for (const tabla of ['audit_logs', 'ai_messages', 'ai_threads', 'learning_recommendations', 'topic_mastery']) {
      await queryInterface.dropTable(tabla, {});
    }
  },
};
