'use strict';

// Catálogo de roles (entidad de seguridad) y relación users.role → roles.code.
// Son datos de referencia del sistema, no datos de prueba: sin ellos ninguna cuenta puede existir.
const ROLES = [
  ['platform_admin', 'Administración de plataforma', 'Opera MENTOR AI: crea instituciones y su primera administración.'],
  ['institution_admin', 'Administración de institución', 'Gestiona usuarios, cursos, Drive, consumo de IA y gobernanza de su institución.'],
  ['teacher', 'Docente', 'Crea y califica el contenido de sus cursos y usa los asistentes de docencia.'],
  ['student', 'Estudiante', 'Aprende en sus cursos, usa el tutor y gestiona su propia cuenta.'],
  ['auditor', 'Auditoría', 'Acceso de solo lectura a bitácoras y reportes de gobernanza de su institución.'],
];
const ENUM_ROLES = ROLES.map(([code]) => code);

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('roles', {
      code: { type: Sequelize.STRING(30), allowNull: false, primaryKey: true },
      name: { type: Sequelize.STRING(80), allowNull: false },
      description: { type: Sequelize.STRING(255), allowNull: false },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });
    await queryInterface.bulkInsert('roles', ROLES.map(([code, name, description]) => ({ code, name, description })));
    await queryInterface.changeColumn('users', 'role', { type: Sequelize.STRING(30), allowNull: false });
    await queryInterface.addConstraint('users', {
      fields: ['role'], type: 'foreign key', name: 'fk_users_role',
      references: { table: 'roles', field: 'code' }, onUpdate: 'CASCADE', onDelete: 'RESTRICT',
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeConstraint('users', 'fk_users_role');
    await queryInterface.removeIndex('users', 'fk_users_role').catch(() => {});
    await queryInterface.changeColumn('users', 'role', { type: Sequelize.ENUM(...ENUM_ROLES), allowNull: false });
    await queryInterface.dropTable('roles');
  },
};
