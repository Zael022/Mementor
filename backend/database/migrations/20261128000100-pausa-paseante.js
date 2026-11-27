'use strict';

// Parte A: Pausa paseante. Dos preferencias nuevas: si puede pasear y el día en que se escondió («por hoy»).
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('user_preferences', 'pausa_walks', { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true });
    await queryInterface.addColumn('user_preferences', 'pausa_hidden_on', { type: Sequelize.DATEONLY, allowNull: true });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('user_preferences', 'pausa_hidden_on');
    await queryInterface.removeColumn('user_preferences', 'pausa_walks');
  },
};
