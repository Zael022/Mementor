'use strict';

// Coordinación entre instancias (turno de tareas y límites compartidos) y retención de datos.
module.exports = {
  async up(queryInterface, Sequelize) {
    // Turno de tareas periódicas: solo la instancia que lo tiene vigente las ejecuta.
    await queryInterface.createTable('job_leases', {
      name: { type: Sequelize.STRING(60), allowNull: false, primaryKey: true },
      owner: { type: Sequelize.STRING(64), allowNull: true },
      expires_at: { type: Sequelize.DATE(3), allowNull: true },
    });

    // Contadores de límites por IP compartidos entre instancias (RATE_LIMIT_STORE=mysql).
    await queryInterface.createTable('rate_limit_hits', {
      rate_key: { type: Sequelize.STRING(255), allowNull: false, primaryKey: true },
      hits: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      reset_at: { type: Sequelize.DATE(3), allowNull: false },
    });
    await queryInterface.addIndex('rate_limit_hits', ['reset_at'], { name: 'ix_rate_limit_reset' });

    // Consumo antiguo resumido por mes; el detalle se borra después del plazo configurado.
    await queryInterface.createTable('ai_usage_monthly', {
      id: { type: Sequelize.BIGINT.UNSIGNED, allowNull: false, primaryKey: true, autoIncrement: true },
      institution_id: {
        type: Sequelize.BIGINT.UNSIGNED, allowNull: false, references: { model: 'institutions', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'CASCADE',
      },
      month: { type: Sequelize.CHAR(7), allowNull: false },
      provider: { type: Sequelize.STRING(30), allowNull: false, defaultValue: '' },
      model: { type: Sequelize.STRING(120), allowNull: false, defaultValue: '' },
      outcome: { type: Sequelize.STRING(30), allowNull: false },
      events: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      input_tokens: { type: Sequelize.BIGINT, allowNull: false, defaultValue: 0 },
      output_tokens: { type: Sequelize.BIGINT, allowNull: false, defaultValue: 0 },
      latency_ms_total: { type: Sequelize.BIGINT, allowNull: false, defaultValue: 0 },
    });
    await queryInterface.addIndex('ai_usage_monthly', ['institution_id', 'month', 'provider', 'model', 'outcome'], { unique: true, name: 'uq_usage_monthly' });

    // Fecha en que se borró el texto de una versión antigua que ninguna respuesta citaba.
    await queryInterface.addColumn('source_versions', 'text_purged_at', { type: Sequelize.DATE, allowNull: true });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('source_versions', 'text_purged_at');
    await queryInterface.dropTable('ai_usage_monthly');
    await queryInterface.dropTable('rate_limit_hits');
    await queryInterface.dropTable('job_leases');
  },
};
