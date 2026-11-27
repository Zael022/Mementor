'use strict';

// Tipo de cambio guardado (fuente pública) y bitácora de integraciones externas y de n8n.
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('exchange_rates', {
      id: { type: Sequelize.BIGINT.UNSIGNED, allowNull: false, primaryKey: true, autoIncrement: true },
      rate_date: { type: Sequelize.DATEONLY, allowNull: false },
      source: { type: Sequelize.STRING(30), allowNull: false },
      buy: { type: Sequelize.DECIMAL(10, 4), allowNull: false },
      sell: { type: Sequelize.DECIMAL(10, 4), allowNull: false },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });
    await queryInterface.addIndex('exchange_rates', ['rate_date', 'source'], { unique: true, name: 'uq_exchange_rates_date_source' });

    await queryInterface.createTable('integration_runs', {
      id: { type: Sequelize.BIGINT.UNSIGNED, allowNull: false, primaryKey: true, autoIncrement: true },
      // Ejemplos: api:hacienda, api:feriados, n8n:tipo-cambio, n8n:recordatorios, n8n:baja.
      integration: { type: Sequelize.STRING(40), allowNull: false },
      direction: { type: Sequelize.ENUM('outbound', 'inbound'), allowNull: false },
      status: { type: Sequelize.ENUM('ok', 'error'), allowNull: false },
      detail: { type: Sequelize.STRING(255), allowNull: true },
      latency_ms: { type: Sequelize.INTEGER, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });
    await queryInterface.addIndex('integration_runs', ['integration', 'created_at'], { name: 'ix_integration_runs_name_created' });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('integration_runs', {});
    await queryInterface.dropTable('exchange_rates', {});
  },
};
