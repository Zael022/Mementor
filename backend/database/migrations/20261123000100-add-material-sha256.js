'use strict';

// Huella SHA-256 del original de cada material de archivo: permite comprobar que una copia
// restaurada o descargada es idéntica a la que subió el docente.
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('materials', 'content_sha256', { type: Sequelize.CHAR(64), allowNull: true, after: 'size_bytes' });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('materials', 'content_sha256');
  },
};
