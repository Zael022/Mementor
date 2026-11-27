'use strict';

// Cambios de correo pendientes: el nuevo correo solo se aplica al abrir el enlace enviado a esa dirección.
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('email_changes', {
      id: { type: Sequelize.BIGINT.UNSIGNED, allowNull: false, primaryKey: true, autoIncrement: true },
      user_id: {
        type: Sequelize.BIGINT.UNSIGNED, allowNull: false,
        references: { model: 'users', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'CASCADE',
      },
      new_email: { type: Sequelize.STRING(190), allowNull: false },
      // Solo se guarda el hash del token; el token viaja únicamente en el correo.
      token_hash: { type: Sequelize.CHAR(64), allowNull: false, unique: true },
      expires_at: { type: Sequelize.DATE, allowNull: false },
      used_at: { type: Sequelize.DATE, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });
    await queryInterface.addIndex('email_changes', ['user_id'], { name: 'ix_email_changes_user' });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('email_changes', {});
  },
};
