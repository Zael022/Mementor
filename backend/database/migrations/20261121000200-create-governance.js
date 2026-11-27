'use strict';

const { cambiarEnum } = require('../compat.cjs');

// Gobernanza de datos (Ley 8968): rol auditor, aceptación de políticas y solicitudes de eliminación.
const ROLES_ANTES = ['platform_admin', 'institution_admin', 'teacher', 'student'];
const fechas = (Sequelize) => ({
  created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
  updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
});
const ref = (Sequelize, tabla, onDelete = 'CASCADE', allowNull = false) => ({
  type: Sequelize.BIGINT.UNSIGNED, allowNull, references: { model: tabla, key: 'id' }, onUpdate: 'CASCADE', onDelete,
});

module.exports = {
  async up(queryInterface, Sequelize) {
    await cambiarEnum(queryInterface, Sequelize, 'users', 'role', [...ROLES_ANTES, 'auditor'], { allowNull: false });
    // Momento en que se anonimizó la cuenta por una solicitud de baja.
    await queryInterface.addColumn('users', 'anonymized_at', { type: Sequelize.DATE, allowNull: true });

    // Evidencia de que la persona aceptó una versión concreta de cada documento.
    await queryInterface.createTable('consent_records', {
      id: { type: Sequelize.BIGINT.UNSIGNED, allowNull: false, primaryKey: true, autoIncrement: true },
      user_id: ref(Sequelize, 'users'),
      document: { type: Sequelize.ENUM('terms', 'privacy'), allowNull: false },
      version: { type: Sequelize.STRING(20), allowNull: false },
      accepted_at: { type: Sequelize.DATE, allowNull: false },
      ...fechas(Sequelize),
    });
    await queryInterface.addIndex('consent_records', ['user_id', 'document', 'version'], { unique: true, name: 'uq_consent_user_document_version' });

    await queryInterface.createTable('data_deletion_requests', {
      id: { type: Sequelize.BIGINT.UNSIGNED, allowNull: false, primaryKey: true, autoIncrement: true },
      user_id: ref(Sequelize, 'users'),
      institution_id: ref(Sequelize, 'institutions', 'SET NULL', true),
      status: { type: Sequelize.ENUM('pending', 'completed', 'rejected'), allowNull: false, defaultValue: 'pending' },
      reason: { type: Sequelize.STRING(500), allowNull: true },
      identity_confirmed_at: { type: Sequelize.DATE, allowNull: false },
      processed_at: { type: Sequelize.DATE, allowNull: true },
      processed_via: { type: Sequelize.ENUM('app', 'n8n'), allowNull: true },
      // Qué se conservó y por qué (obligación académica o legal).
      retained_summary: { type: Sequelize.TEXT, allowNull: true },
      notification_status: { type: Sequelize.ENUM('sent', 'not_configured', 'failed'), allowNull: true },
      ...fechas(Sequelize),
    });
    await queryInterface.addIndex('data_deletion_requests', ['institution_id', 'status'], { name: 'ix_deletion_institution_status' });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('data_deletion_requests', {});
    await queryInterface.dropTable('consent_records', {});
    await queryInterface.removeColumn('users', 'anonymized_at');
    // Antes de quitar el rol se desactivan las cuentas de auditoría para no romper el ENUM.
    await queryInterface.sequelize.query("UPDATE users SET role = 'teacher', status = 'disabled' WHERE role = 'auditor'");
    await cambiarEnum(queryInterface, Sequelize, 'users', 'role', ROLES_ANTES, { allowNull: false });
  },
};
