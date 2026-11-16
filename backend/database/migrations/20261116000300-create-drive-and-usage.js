'use strict';

// Crea carpetas de Drive habilitadas, su vínculo con cursos y el registro técnico de consumo de IA.
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
    // Carpetas que la institución autoriza a vincular con cursos.
    await queryInterface.createTable('institution_drive_folders', {
      id: id(Sequelize),
      institution_id: fk(Sequelize, 'institutions'),
      folder_id: { type: Sequelize.STRING(128), allowNull: false },
      label: { type: Sequelize.STRING(180), allowNull: false },
      status: { type: Sequelize.ENUM('enabled', 'disabled'), allowNull: false, defaultValue: 'enabled' },
      created_by: fk(Sequelize, 'users', 'SET NULL', true),
      ...fechas(Sequelize),
    });
    await queryInterface.addIndex('institution_drive_folders', ['institution_id', 'folder_id'], { unique: true, name: 'uq_drive_folders_institution' });

    // Vínculo de un curso con una carpeta y el estado de su sincronización reanudable.
    await queryInterface.createTable('course_drive_links', {
      id: id(Sequelize),
      institution_id: fk(Sequelize, 'institutions'),
      course_id: fk(Sequelize, 'courses', 'CASCADE'),
      drive_folder_id: fk(Sequelize, 'institution_drive_folders'),
      status: { type: Sequelize.ENUM('active', 'removed'), allowNull: false, defaultValue: 'active' },
      sync_state: { type: Sequelize.ENUM('idle', 'running', 'interrupted', 'error'), allowNull: false, defaultValue: 'idle' },
      sync_run_id: { type: Sequelize.STRING(36), allowNull: true },
      page_token: { type: Sequelize.TEXT, allowNull: true },
      files_listed: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      last_sync_started_at: { type: Sequelize.DATE, allowNull: true },
      last_sync_completed_at: { type: Sequelize.DATE, allowNull: true },
      last_error: { type: Sequelize.STRING(500), allowNull: true },
      created_by: fk(Sequelize, 'users', 'SET NULL', true),
      ...fechas(Sequelize),
    });
    await queryInterface.addIndex('course_drive_links', ['course_id', 'status'], { name: 'ix_drive_links_course' });

    await queryInterface.addColumn('knowledge_sources', 'drive_link_id', fk(Sequelize, 'course_drive_links', 'SET NULL', true));
    await queryInterface.addColumn('knowledge_sources', 'last_seen_run', { type: Sequelize.STRING(36), allowNull: true });

    // Registro técnico de cada consulta al tutor: sin preguntas, respuestas ni contenido de documentos.
    await queryInterface.createTable('ai_usage_events', {
      id: id(Sequelize),
      institution_id: fk(Sequelize, 'institutions'),
      user_id: fk(Sequelize, 'users'),
      course_id: fk(Sequelize, 'courses', 'SET NULL', true),
      provider: { type: Sequelize.STRING(30), allowNull: true },
      model: { type: Sequelize.STRING(120), allowNull: true },
      retrieval_mode: { type: Sequelize.STRING(20), allowNull: true },
      streamed: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      outcome: {
        type: Sequelize.ENUM('reserved', 'completed', 'no_evidence', 'no_citations', 'invalid_format', 'provider_error', 'retrieval_error', 'cancelled'),
        allowNull: false,
        defaultValue: 'reserved',
      },
      latency_ms: { type: Sequelize.INTEGER, allowNull: true },
      input_tokens: { type: Sequelize.INTEGER, allowNull: true },
      output_tokens: { type: Sequelize.INTEGER, allowNull: true },
      ...fechas(Sequelize),
    });
    await queryInterface.addIndex('ai_usage_events', ['user_id', 'created_at'], { name: 'ix_usage_user_created' });
    await queryInterface.addIndex('ai_usage_events', ['institution_id', 'created_at'], { name: 'ix_usage_institution_created' });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('ai_usage_events');
    await queryInterface.removeColumn('knowledge_sources', 'last_seen_run');
    await queryInterface.removeColumn('knowledge_sources', 'drive_link_id');
    await queryInterface.dropTable('course_drive_links');
    await queryInterface.dropTable('institution_drive_folders');
  },
};
