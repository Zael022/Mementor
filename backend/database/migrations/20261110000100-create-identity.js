'use strict';

// Crea usuarios y sesiones; no inserta ninguna cuenta.
const fechas = (Sequelize) => ({
  created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
  updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
});
const id = (Sequelize) => ({ type: Sequelize.BIGINT.UNSIGNED, allowNull: false, primaryKey: true, autoIncrement: true });
const fk = (Sequelize, tabla, allowNull = false) => ({
  type: Sequelize.BIGINT.UNSIGNED,
  allowNull,
  references: { model: tabla, key: 'id' },
  onUpdate: 'CASCADE',
  onDelete: 'RESTRICT',
});

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('institutions', 'status', {
      type: Sequelize.ENUM('active', 'inactive'),
      allowNull: false,
      defaultValue: 'active',
    });

    await queryInterface.createTable('users', {
      id: id(Sequelize),
      institution_id: fk(Sequelize, 'institutions', true),
      email: { type: Sequelize.STRING(190), allowNull: false, unique: true },
      password_hash: { type: Sequelize.STRING(255), allowNull: true },
      display_name: { type: Sequelize.STRING(120), allowNull: false },
      role: { type: Sequelize.ENUM('platform_admin', 'institution_admin', 'teacher', 'student'), allowNull: false },
      status: { type: Sequelize.ENUM('invited', 'active', 'disabled'), allowNull: false, defaultValue: 'invited' },
      invitation_token_hash: { type: Sequelize.CHAR(64), allowNull: true, unique: true },
      invitation_expires_at: { type: Sequelize.DATE, allowNull: true },
      failed_login_count: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      locked_until: { type: Sequelize.DATE, allowNull: true },
      ...fechas(Sequelize),
    });
    await queryInterface.addIndex('users', ['institution_id', 'role'], { name: 'ix_users_institution_role' });

    await queryInterface.createTable('user_sessions', {
      id: id(Sequelize),
      user_id: { ...fk(Sequelize, 'users'), onDelete: 'CASCADE' },
      token_hash: { type: Sequelize.CHAR(64), allowNull: false, unique: true },
      csrf_token: { type: Sequelize.CHAR(64), allowNull: false },
      expires_at: { type: Sequelize.DATE, allowNull: false },
      revoked_at: { type: Sequelize.DATE, allowNull: true },
      ...fechas(Sequelize),
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('user_sessions', {});
    await queryInterface.dropTable('users', {});
    await queryInterface.removeColumn('institutions', 'status');
  },
};
