// Índices para filtros y agregados de inicio, analítica y conversaciones.
const indexes = [
  { table: 'class_sessions', fields: ['course_id', 'status', 'starts_at'], name: 'ix_sessions_course_status_start' },
  { table: 'assessment_attempts', fields: ['assessment_id', 'status', 'student_id'], name: 'ix_attempts_assessment_status_student' },
  { table: 'attempt_answers', fields: ['question_id', 'is_correct'], name: 'ix_answers_question_correct' },
  { table: 'ai_threads', fields: ['user_id', 'course_id', 'id'], name: 'ix_threads_user_course_id' },
];

module.exports = {
  async up(queryInterface) {
    for (const { table, fields, name } of indexes) {
      const current = await queryInterface.showIndex(table);
      if (!current.some((index) => index.name === name)) await queryInterface.addIndex(table, fields, { name });
    }
  },

  async down(queryInterface) {
    for (const { table, fields, name } of [...indexes].reverse()) {
      const current = await queryInterface.showIndex(table);
      if (!current.some((index) => index.name === name)) continue;
      // MySQL puede sustituir el índice implícito de una FK al crear el compuesto.
      if (!current.some((index) => index.name !== name && index.fields[0]?.attribute === fields[0])) {
        await queryInterface.addIndex(table, [fields[0]], { name: `ix_${table}_${fields[0]}` });
      }
      await queryInterface.removeIndex(table, name);
    }
  },
};
