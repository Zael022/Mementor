'use strict';

// Crea el registro de fuentes del tutor: corpus por curso, fuentes, versiones y su uso en respuestas.
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
    // Un corpus de RAG Engine por curso, asociado a su institución.
    await queryInterface.createTable('course_rag_corpora', {
      id: id(Sequelize),
      institution_id: fk(Sequelize, 'institutions'),
      course_id: fk(Sequelize, 'courses', 'CASCADE'),
      corpus_name: { type: Sequelize.STRING(300), allowNull: true },
      operation_name: { type: Sequelize.STRING(400), allowNull: true },
      status: { type: Sequelize.ENUM('pending', 'creating', 'ready', 'error'), allowNull: false, defaultValue: 'pending' },
      last_error: { type: Sequelize.STRING(500), allowNull: true },
      ...fechas(Sequelize),
    });
    await queryInterface.addIndex('course_rag_corpora', ['course_id'], { unique: true, name: 'uq_rag_corpora_course' });

    // Documento que el tutor puede consultar: lección publicada, material o archivo de Drive.
    await queryInterface.createTable('knowledge_sources', {
      id: id(Sequelize),
      institution_id: fk(Sequelize, 'institutions'),
      course_id: fk(Sequelize, 'courses', 'CASCADE'),
      origin: { type: Sequelize.ENUM('lesson', 'material', 'drive'), allowNull: false },
      source_key: { type: Sequelize.STRING(180), allowNull: false },
      lesson_id: fk(Sequelize, 'lessons', 'SET NULL', true),
      material_id: fk(Sequelize, 'materials', 'SET NULL', true),
      drive_file_id: { type: Sequelize.STRING(128), allowNull: true },
      title: { type: Sequelize.STRING(200), allowNull: false },
      status: { type: Sequelize.ENUM('active', 'retired'), allowNull: false, defaultValue: 'active' },
      retired_at: { type: Sequelize.DATE, allowNull: true },
      retire_reason: { type: Sequelize.STRING(60), allowNull: true },
      active_version_id: { type: Sequelize.BIGINT.UNSIGNED, allowNull: true },
      cleanup_status: { type: Sequelize.ENUM('none', 'pending', 'done', 'error'), allowNull: false, defaultValue: 'none' },
      cleanup_attempts: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      cleanup_error: { type: Sequelize.STRING(500), allowNull: true },
      created_by: fk(Sequelize, 'users', 'SET NULL', true),
      ...fechas(Sequelize),
    });
    await queryInterface.addIndex('knowledge_sources', ['course_id', 'source_key'], { unique: true, name: 'uq_sources_course_key' });
    await queryInterface.addIndex('knowledge_sources', ['course_id', 'status'], { name: 'ix_sources_course_status' });
    await queryInterface.addIndex('knowledge_sources', ['institution_id', 'status'], { name: 'ix_sources_institution_status' });

    // Cada versión publicada de una fuente, con su texto extraído y su ubicación en Google Cloud.
    await queryInterface.createTable('source_versions', {
      id: id(Sequelize),
      source_id: fk(Sequelize, 'knowledge_sources', 'CASCADE'),
      course_id: fk(Sequelize, 'courses', 'CASCADE'),
      version_no: { type: Sequelize.INTEGER, allowNull: false },
      content_hash: { type: Sequelize.CHAR(64), allowNull: false },
      state: { type: Sequelize.ENUM('pending', 'processing', 'ready', 'error', 'superseded', 'retired'), allowNull: false, defaultValue: 'pending' },
      error_code: { type: Sequelize.STRING(60), allowNull: true },
      error_message: { type: Sequelize.STRING(500), allowNull: true },
      text_content: { type: Sequelize.TEXT('long'), allowNull: false },
      char_count: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      pages_json: { type: Sequelize.JSON, allowNull: true },
      mime_type: { type: Sequelize.STRING(120), allowNull: true },
      external_revision: { type: Sequelize.STRING(120), allowNull: true },
      gcs_uri: { type: Sequelize.STRING(500), allowNull: true },
      rag_file_name: { type: Sequelize.STRING(400), allowNull: true },
      import_operation: { type: Sequelize.STRING(400), allowNull: true },
      import_attempts: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      remote_cleanup: { type: Sequelize.ENUM('none', 'pending', 'done', 'error'), allowNull: false, defaultValue: 'none' },
      ready_at: { type: Sequelize.DATE, allowNull: true },
      created_by: fk(Sequelize, 'users', 'SET NULL', true),
      ...fechas(Sequelize),
    });
    await queryInterface.addIndex('source_versions', ['source_id', 'version_no'], { unique: true, name: 'uq_versions_source_no' });
    await queryInterface.addIndex('source_versions', ['state'], { name: 'ix_versions_state' });
    await queryInterface.addIndex('source_versions', ['remote_cleanup'], { name: 'ix_versions_cleanup' });

    // Qué versión respaldó cada respuesta del tutor.
    await queryInterface.createTable('ai_message_sources', {
      id: id(Sequelize),
      message_id: fk(Sequelize, 'ai_messages', 'CASCADE'),
      source_id: fk(Sequelize, 'knowledge_sources', 'CASCADE'),
      source_version_id: fk(Sequelize, 'source_versions', 'CASCADE'),
      course_id: fk(Sequelize, 'courses', 'CASCADE'),
      position: { type: Sequelize.INTEGER, allowNull: false },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });
    await queryInterface.addIndex('ai_message_sources', ['source_version_id'], { name: 'ix_message_sources_version' });

    // Topes por institución; vacío usa el valor por defecto del servidor.
    await queryInterface.addColumn('institutions', 'max_documents', { type: Sequelize.INTEGER, allowNull: true });
    await queryInterface.addColumn('institutions', 'ai_daily_question_limit', { type: Sequelize.INTEGER, allowNull: true });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('institutions', 'ai_daily_question_limit');
    await queryInterface.removeColumn('institutions', 'max_documents');
    for (const tabla of ['ai_message_sources', 'source_versions', 'knowledge_sources', 'course_rag_corpora']) {
      await queryInterface.dropTable(tabla, {});
    }
  },
};
