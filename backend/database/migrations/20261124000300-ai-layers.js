'use strict';

// Capas de IA: versión del prompt, modelo elegido por el router, caché y resultado de los guardrails
// en la bitácora (sin contenido), y la caché de respuestas reutilizables.
const OUTCOMES = ['reserved', 'completed', 'no_evidence', 'no_citations', 'invalid_format', 'provider_error', 'retrieval_error', 'cancelled'];

const traceColumns = (Sequelize) => ({
  prompt_version: { type: Sequelize.STRING(80), allowNull: true },
  model_tier: { type: Sequelize.STRING(20), allowNull: true },
  cache_hit: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
  guard_outcome: { type: Sequelize.STRING(40), allowNull: true },
  cache_read_tokens: { type: Sequelize.INTEGER, allowNull: true },
  cache_write_tokens: { type: Sequelize.INTEGER, allowNull: true },
});

module.exports = {
  async up(queryInterface, Sequelize) {
    for (const table of ['agent_runs', 'ai_usage_events']) {
      for (const [name, definition] of Object.entries(traceColumns(Sequelize))) {
        await queryInterface.addColumn(table, name, definition);
      }
    }
    // Respuesta descartada por los guardrails de salida (el modelo sí se llamó, por eso cuenta en la cuota).
    await queryInterface.changeColumn('ai_usage_events', 'outcome', {
      type: Sequelize.ENUM(...OUTCOMES, 'guard_blocked'), allowNull: false, defaultValue: 'reserved',
    });

    await queryInterface.createTable('ai_response_cache', {
      id: { type: Sequelize.BIGINT.UNSIGNED, allowNull: false, primaryKey: true, autoIncrement: true },
      // Huella de institución + agente + versión del prompt + modelo + entrada exacta.
      cache_key: { type: Sequelize.CHAR(64), allowNull: false, unique: true },
      institution_id: {
        type: Sequelize.BIGINT.UNSIGNED, allowNull: false,
        references: { model: 'institutions', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'CASCADE',
      },
      agent: { type: Sequelize.STRING(40), allowNull: false },
      prompt_version: { type: Sequelize.STRING(80), allowNull: false },
      model: { type: Sequelize.STRING(120), allowNull: false },
      // Fuente de la que salió la respuesta (por ejemplo «lesson:12»), para invalidarla al cambiar o retirarse.
      source_ref: { type: Sequelize.STRING(60), allowNull: false },
      output_json: { type: Sequelize.JSON, allowNull: false },
      hits: { type: Sequelize.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
      expires_at: { type: Sequelize.DATE, allowNull: false },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });
    await queryInterface.addIndex('ai_response_cache', ['source_ref'], { name: 'ix_ai_response_cache_source' });
    await queryInterface.addIndex('ai_response_cache', ['expires_at'], { name: 'ix_ai_response_cache_expires' });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('ai_response_cache');
    // Las filas bloqueadas pasan a «invalid_format» para poder volver al ENUM anterior.
    await queryInterface.sequelize.query("UPDATE ai_usage_events SET outcome = 'invalid_format' WHERE outcome = 'guard_blocked'");
    await queryInterface.changeColumn('ai_usage_events', 'outcome', { type: Sequelize.ENUM(...OUTCOMES), allowNull: false, defaultValue: 'reserved' });
    for (const table of ['agent_runs', 'ai_usage_events']) {
      for (const name of Object.keys(traceColumns(Sequelize))) await queryInterface.removeColumn(table, name);
    }
  },
};
