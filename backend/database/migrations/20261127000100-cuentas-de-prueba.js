'use strict';

// Marca las cuentas de prueba: solo pueden entrar con DEMO_MODE encendido (ADR 0011).
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('users', 'is_demo', { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false });
  },
  async down(queryInterface) {
    await queryInterface.removeColumn('users', 'is_demo');
  },
};
