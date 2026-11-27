'use strict';

// Crea la nota del curso (pesos, trabajo en clase y bono), los quizzes rápidos y la práctica diaria con racha.
const fechas = (Sequelize) => ({
  created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
  updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
});
const id = (Sequelize) => ({ type: Sequelize.BIGINT.UNSIGNED, allowNull: false, primaryKey: true, autoIncrement: true });
const fk = (Sequelize, tabla, onDelete = 'RESTRICT', allowNull = false) => ({
  type: Sequelize.BIGINT.UNSIGNED,
  allowNull,
  references: { model: tabla, key: 'id' },
  onUpdate: 'CASCADE',
  onDelete,
});

module.exports = {
  async up(queryInterface, Sequelize) {
    // Pesos de la nota final y valores del bono; la fila nace cuando el docente guarda su configuración.
    await queryInterface.createTable('course_grade_policies', {
      course_id: { ...fk(Sequelize, 'courses', 'CASCADE'), primaryKey: true },
      assessments_weight: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 40 },
      assignments_weight: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 30 },
      classwork_weight: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 30 },
      quiz_bonus: { type: Sequelize.DECIMAL(4, 2), allowNull: false, defaultValue: 0.1 },
      streak_day_bonus: { type: Sequelize.DECIMAL(4, 2), allowNull: false, defaultValue: 0.09 },
      bonus_cap: { type: Sequelize.DECIMAL(4, 2), allowNull: false, defaultValue: 1 },
      ...fechas(Sequelize),
    });

    // Actividades de trabajo en clase que el docente califica a mano.
    await queryInterface.createTable('class_work_items', {
      id: id(Sequelize),
      course_id: fk(Sequelize, 'courses', 'CASCADE'),
      title: { type: Sequelize.STRING(180), allowNull: false },
      max_points: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 100 },
      work_date: { type: Sequelize.DATEONLY, allowNull: true },
      created_by: fk(Sequelize, 'users'),
      ...fechas(Sequelize),
    });
    await queryInterface.addIndex('class_work_items', ['course_id'], { name: 'ix_class_work_course' });

    await queryInterface.createTable('class_work_grades', {
      id: id(Sequelize),
      item_id: fk(Sequelize, 'class_work_items', 'CASCADE'),
      student_id: fk(Sequelize, 'users', 'CASCADE'),
      points: { type: Sequelize.DECIMAL(6, 2), allowNull: false },
      feedback: { type: Sequelize.STRING(1000), allowNull: true },
      graded_by: fk(Sequelize, 'users'),
      ...fechas(Sequelize),
    });
    await queryInterface.addIndex('class_work_grades', ['item_id', 'student_id'], { unique: true, name: 'uq_class_work_item_student' });

    await queryInterface.createTable('quick_quizzes', {
      id: id(Sequelize),
      course_id: fk(Sequelize, 'courses', 'CASCADE'),
      title: { type: Sequelize.STRING(180), allowNull: false },
      status: { type: Sequelize.ENUM('draft', 'published', 'archived'), allowNull: false, defaultValue: 'draft' },
      seconds_per_question: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 20 },
      created_by: fk(Sequelize, 'users'),
      ...fechas(Sequelize),
    });
    await queryInterface.addIndex('quick_quizzes', ['course_id', 'status'], { name: 'ix_quick_quizzes_course_status' });

    await queryInterface.createTable('quick_quiz_questions', {
      id: id(Sequelize),
      quiz_id: fk(Sequelize, 'quick_quizzes', 'CASCADE'),
      prompt: { type: Sequelize.STRING(500), allowNull: false },
      position: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 1 },
      ...fechas(Sequelize),
    });
    await queryInterface.addIndex('quick_quiz_questions', ['quiz_id', 'position'], { name: 'ix_quick_questions_quiz_position' });

    await queryInterface.createTable('quick_quiz_options', {
      id: id(Sequelize),
      question_id: fk(Sequelize, 'quick_quiz_questions', 'CASCADE'),
      body: { type: Sequelize.STRING(200), allowNull: false },
      is_correct: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      position: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 1 },
      ...fechas(Sequelize),
    });
    await queryInterface.addIndex('quick_quiz_options', ['question_id'], { name: 'ix_quick_options_question' });

    // Cada partida de un estudiante; el servidor mide el tiempo de cada respuesta.
    await queryInterface.createTable('quiz_plays', {
      id: id(Sequelize),
      quiz_id: fk(Sequelize, 'quick_quizzes', 'CASCADE'),
      student_id: fk(Sequelize, 'users', 'CASCADE'),
      status: { type: Sequelize.ENUM('in_progress', 'finished'), allowNull: false, defaultValue: 'in_progress' },
      total_questions: { type: Sequelize.INTEGER, allowNull: false },
      correct_count: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      score: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      perfect: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      finished_at: { type: Sequelize.DATE, allowNull: true },
      ...fechas(Sequelize),
    });
    await queryInterface.addIndex('quiz_plays', ['quiz_id', 'student_id'], { name: 'ix_quiz_plays_quiz_student' });
    await queryInterface.addIndex('quiz_plays', ['student_id', 'status'], { name: 'ix_quiz_plays_student_status' });

    await queryInterface.createTable('quiz_play_answers', {
      id: id(Sequelize),
      play_id: fk(Sequelize, 'quiz_plays', 'CASCADE'),
      question_id: fk(Sequelize, 'quick_quiz_questions', 'CASCADE'),
      option_id: fk(Sequelize, 'quick_quiz_options', 'SET NULL', true),
      shown_at: { type: Sequelize.DATE(3), allowNull: false },
      answered_at: { type: Sequelize.DATE(3), allowNull: true },
      is_correct: { type: Sequelize.BOOLEAN, allowNull: true },
      points: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      ...fechas(Sequelize),
    });
    await queryInterface.addIndex('quiz_play_answers', ['play_id', 'question_id'], { unique: true, name: 'uq_play_answers_play_question' });

    // Práctica del día: preguntas elegidas del banco del curso y su avance.
    await queryInterface.createTable('daily_practices', {
      id: id(Sequelize),
      course_id: fk(Sequelize, 'courses', 'CASCADE'),
      student_id: fk(Sequelize, 'users', 'CASCADE'),
      practice_day: { type: Sequelize.DATEONLY, allowNull: false },
      question_ids: { type: Sequelize.JSON, allowNull: false },
      answered_count: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      completed_at: { type: Sequelize.DATE, allowNull: true },
      ...fechas(Sequelize),
    });
    await queryInterface.addIndex('daily_practices', ['course_id', 'student_id', 'practice_day'], { unique: true, name: 'uq_daily_course_student_day' });

    await queryInterface.createTable('daily_practice_answers', {
      id: id(Sequelize),
      practice_id: fk(Sequelize, 'daily_practices', 'CASCADE'),
      question_id: fk(Sequelize, 'quick_quiz_questions', 'CASCADE'),
      option_id: fk(Sequelize, 'quick_quiz_options', 'SET NULL', true),
      is_correct: { type: Sequelize.BOOLEAN, allowNull: false },
      ...fechas(Sequelize),
    });
    await queryInterface.addIndex('daily_practice_answers', ['practice_id', 'question_id'], { unique: true, name: 'uq_daily_answers_practice_question' });

    await queryInterface.createTable('course_streaks', {
      id: id(Sequelize),
      course_id: fk(Sequelize, 'courses', 'CASCADE'),
      student_id: fk(Sequelize, 'users', 'CASCADE'),
      current_days: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      best_days: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      last_day: { type: Sequelize.DATEONLY, allowNull: true },
      ...fechas(Sequelize),
    });
    await queryInterface.addIndex('course_streaks', ['course_id', 'student_id'], { unique: true, name: 'uq_streaks_course_student' });

    // Cada punto de bono queda registrado una sola vez (índice único) para poder auditarlo.
    await queryInterface.createTable('grade_bonus_events', {
      id: id(Sequelize),
      course_id: fk(Sequelize, 'courses', 'CASCADE'),
      student_id: fk(Sequelize, 'users', 'CASCADE'),
      kind: { type: Sequelize.ENUM('quiz', 'streak_day'), allowNull: false },
      reference: { type: Sequelize.STRING(40), allowNull: false },
      amount: { type: Sequelize.DECIMAL(5, 2), allowNull: false },
      ...fechas(Sequelize),
    });
    await queryInterface.addIndex('grade_bonus_events', ['course_id', 'student_id', 'kind', 'reference'], { unique: true, name: 'uq_bonus_course_student_kind_ref' });
  },

  async down(queryInterface) {
    for (const tabla of [
      'grade_bonus_events', 'course_streaks', 'daily_practice_answers', 'daily_practices',
      'quiz_play_answers', 'quiz_plays', 'quick_quiz_options', 'quick_quiz_questions', 'quick_quizzes', 'class_work_grades', 'class_work_items', 'course_grade_policies',
    ]) {
      await queryInterface.dropTable(tabla, {});
    }
  },
};
