'use strict';

// Bitácora de cada ejecución de un agente de IA (sin guardar el contenido de las entradas ni de las respuestas).
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('agent_runs', {
      id: { type: Sequelize.BIGINT.UNSIGNED, allowNull: false, primaryKey: true, autoIncrement: true },
      institution_id: {
        type: Sequelize.BIGINT.UNSIGNED, allowNull: true, references: { model: 'institutions', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'CASCADE',
      },
      user_id: {
        type: Sequelize.BIGINT.UNSIGNED, allowNull: false, references: { model: 'users', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'CASCADE',
      },
      course_id: {
        type: Sequelize.BIGINT.UNSIGNED, allowNull: true, references: { model: 'courses', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'SET NULL',
      },
      agent: { type: Sequelize.STRING(40), allowNull: false },
      status: { type: Sequelize.ENUM('running', 'completed', 'no_evidence', 'failed'), allowNull: false, defaultValue: 'running' },
      provider: { type: Sequelize.STRING(40), allowNull: true },
      model: { type: Sequelize.STRING(120), allowNull: true },
      input_chars: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      output_chars: { type: Sequelize.INTEGER, allowNull: true },
      input_tokens: { type: Sequelize.INTEGER, allowNull: true },
      output_tokens: { type: Sequelize.INTEGER, allowNull: true },
      latency_ms: { type: Sequelize.INTEGER, allowNull: true },
      error_code: { type: Sequelize.STRING(40), allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });
    await queryInterface.addIndex('agent_runs', ['user_id', 'created_at'], { name: 'ix_agent_runs_user_created' });
    await queryInterface.addIndex('agent_runs', ['institution_id', 'agent', 'created_at'], { name: 'ix_agent_runs_institution_agent' });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('agent_runs');
  },
};
