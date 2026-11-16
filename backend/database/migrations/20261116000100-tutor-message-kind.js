'use strict';

// Distingue respuestas del tutor de avisos (material insuficiente, formato inválido).
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('ai_messages', 'kind', {
      type: Sequelize.ENUM('answer', 'notice'), allowNull: false, defaultValue: 'answer',
    });
    await queryInterface.addColumn('ai_messages', 'notice_code', { type: Sequelize.STRING(60), allowNull: true });
    await queryInterface.addIndex('ai_messages', ['thread_id', 'id'], { name: 'ix_ai_messages_thread' });
  },

  async down(queryInterface) {
    // La clave foránea de thread_id necesita un índice: se crea uno simple antes de quitar el compuesto.
    await queryInterface.addIndex('ai_messages', ['thread_id'], { name: 'ix_ai_messages_thread_id' });
    await queryInterface.removeIndex('ai_messages', 'ix_ai_messages_thread');
    await queryInterface.removeColumn('ai_messages', 'notice_code');
    await queryInterface.removeColumn('ai_messages', 'kind');
  },
};
