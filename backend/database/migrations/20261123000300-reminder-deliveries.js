'use strict';

// Registro de recordatorios por persona y día (evita repetir envíos al reintentar)
// y preferencia para dejar de recibirlos.
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('reminder_deliveries', {
      id: { type: Sequelize.BIGINT.UNSIGNED, allowNull: false, primaryKey: true, autoIncrement: true },
      user_id: {
        type: Sequelize.BIGINT.UNSIGNED, allowNull: false,
        references: { model: 'users', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'CASCADE',
      },
      reminder_day: { type: Sequelize.DATEONLY, allowNull: false },
      status: { type: Sequelize.ENUM('sent', 'failed'), allowNull: false },
      attempts: { type: Sequelize.INTEGER.UNSIGNED, allowNull: false, defaultValue: 1 },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });
    await queryInterface.addIndex('reminder_deliveries', ['user_id', 'reminder_day'], { unique: true, name: 'ux_reminder_deliveries_user_day' });
    await queryInterface.addColumn('user_preferences', 'email_reminders', { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('user_preferences', 'email_reminders');
    await queryInterface.dropTable('reminder_deliveries');
  },
};
