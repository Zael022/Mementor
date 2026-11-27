'use strict';

// Preferencias de mascotas y celebraciones, y partidas del juego Parejas.
// El rango de avance no necesita tabla: se calcula al consultar (ADR 0010).
module.exports = {
  async up(queryInterface, Sequelize) {
    // PostgreSQL no tiene TINYINT: allí se usa SMALLINT (MySQL queda igual).
    const pequeno = queryInterface.sequelize.getDialect() === 'postgres' ? Sequelize.SMALLINT : Sequelize.TINYINT.UNSIGNED;
    await queryInterface.addColumn('user_preferences', 'show_mascots', { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true });
    await queryInterface.addColumn('user_preferences', 'show_big_celebrations', { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true });

    const fk = (tabla) => ({
      type: Sequelize.BIGINT.UNSIGNED,
      allowNull: false,
      references: { model: tabla, key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
    });

    // Partida de práctica: el tablero con las parejas vive solo en el servidor.
    await queryInterface.createTable('memory_games', {
      id: { type: Sequelize.BIGINT.UNSIGNED, allowNull: false, primaryKey: true, autoIncrement: true },
      institution_id: fk('institutions'),
      course_id: fk('courses'),
      module_id: fk('modules'),
      student_id: fk('users'),
      status: { type: Sequelize.ENUM('in_progress', 'finished'), allowNull: false, defaultValue: 'in_progress' },
      pair_count: { type: pequeno, allowNull: false },
      board: { type: Sequelize.JSON, allowNull: false },
      matched_pairs: { type: pequeno, allowNull: false, defaultValue: 0 },
      attempts: { type: Sequelize.SMALLINT.UNSIGNED, allowNull: false, defaultValue: 0 },
      started_at: { type: Sequelize.DATE(3), allowNull: false },
      finished_at: { type: Sequelize.DATE(3), allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });
    await queryInterface.addIndex('memory_games', ['student_id', 'module_id', 'status'], { name: 'ix_memory_games_student_module' });
    await queryInterface.addIndex('memory_games', ['course_id'], { name: 'ix_memory_games_course' });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('memory_games', {});
    await queryInterface.removeColumn('user_preferences', 'show_big_celebrations');
    await queryInterface.removeColumn('user_preferences', 'show_mascots');
  },
};
