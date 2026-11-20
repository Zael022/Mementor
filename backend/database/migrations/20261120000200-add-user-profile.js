'use strict';

// Datos personales que edita la propia persona y su foto de perfil.
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('users', 'first_name', { type: Sequelize.STRING(80), allowNull: true });
    await queryInterface.addColumn('users', 'last_name', { type: Sequelize.STRING(80), allowNull: true });
    await queryInterface.addColumn('users', 'phone', { type: Sequelize.STRING(30), allowNull: true });
    await queryInterface.addColumn('users', 'bio', { type: Sequelize.STRING(500), allowNull: true });
    // Nombre del archivo guardado (aleatorio) y fecha del último cambio para invalidar la caché.
    await queryInterface.addColumn('users', 'avatar_file', { type: Sequelize.STRING(64), allowNull: true });
    await queryInterface.addColumn('users', 'avatar_updated_at', { type: Sequelize.DATE, allowNull: true });
  },

  async down(queryInterface) {
    for (const column of ['avatar_updated_at', 'avatar_file', 'bio', 'phone', 'last_name', 'first_name']) {
      await queryInterface.removeColumn('users', column);
    }
  },
};
