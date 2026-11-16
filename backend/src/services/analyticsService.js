import { QueryTypes } from 'sequelize';
import { sequelize } from '../models/index.js';
import { getCourseAccess } from './accessService.js';

const num = (value) => (value === null || value === undefined ? null : Number(value));

// Calcula la analítica del curso solo con registros reales.
export async function getCourseAnalytics(user, courseId) {
  const { course } = await getCourseAccess(user, courseId, { write: true });
  const options = { replacements: { courseId: course.id }, type: QueryTypes.SELECT };

  const [assessments, topics, students] = await Promise.all([
    sequelize.query(
      `SELECT a.id, a.title, a.status, a.passing_score AS passingScore,
              COUNT(att.id) AS submittedAttempts,
              COUNT(DISTINCT att.student_id) AS studentsWithAttempts,
              AVG(att.score_pct) AS averageScorePct,
              SUM(att.score_pct >= a.passing_score) AS passedAttempts
         FROM assessments a
         LEFT JOIN assessment_attempts att ON att.assessment_id = a.id AND att.status = 'submitted'
        WHERE a.course_id = :courseId
        GROUP BY a.id
        ORDER BY a.id`,
      options,
    ),
    sequelize.query(
      `SELECT t.id, t.title,
              COALESCE(responses.answers, 0) AS answers,
              responses.correctAnswers,
              mastery.averageMastery,
              COALESCE(mastery.studentsWithEvidence, 0) AS studentsWithEvidence
         FROM topics t
         JOIN modules m ON m.id = t.module_id
         LEFT JOIN (
           SELECT q.topic_id, COUNT(*) AS answers, SUM(aa.is_correct) AS correctAnswers
             FROM questions q
             JOIN topics scope ON scope.id = q.topic_id AND scope.course_id = :courseId
             JOIN attempt_answers aa ON aa.question_id = q.id
            GROUP BY q.topic_id
         ) responses ON responses.topic_id = t.id
         LEFT JOIN (
           SELECT tm.topic_id, AVG(tm.mastery_score) AS averageMastery, COUNT(*) AS studentsWithEvidence
             FROM topic_mastery tm
             JOIN topics scope ON scope.id = tm.topic_id AND scope.course_id = :courseId
            GROUP BY tm.topic_id
         ) mastery ON mastery.topic_id = t.id
        WHERE t.course_id = :courseId
        ORDER BY m.position, t.position, t.id`,
      options,
    ),
    sequelize.query(
      `SELECT u.id, u.display_name AS displayName,
              COUNT(att.id) AS submittedAttempts,
              AVG(att.score_pct) AS averageScorePct,
              MAX(att.submitted_at) AS lastSubmittedAt
         FROM enrollments e
         JOIN users u ON u.id = e.student_id
         LEFT JOIN assessment_attempts att ON att.student_id = u.id AND att.status = 'submitted'
              AND att.assessment_id IN (SELECT id FROM assessments WHERE course_id = :courseId)
        WHERE e.course_id = :courseId AND e.status = 'active'
        GROUP BY u.id
        ORDER BY u.display_name`,
      options,
    ),
  ]);

  return {
    course: { id: course.id, title: course.title, status: course.status },
    enrolledStudents: students.length,
    assessments: assessments.map((row) => ({
      id: row.id,
      title: row.title,
      status: row.status,
      passingScore: row.passingScore,
      submittedAttempts: Number(row.submittedAttempts),
      studentsWithAttempts: Number(row.studentsWithAttempts),
      averageScorePct: num(row.averageScorePct),
      passRatePct: Number(row.submittedAttempts) > 0 ? Math.round((Number(row.passedAttempts) / Number(row.submittedAttempts)) * 100) : null,
    })),
    topics: topics.map((row) => ({
      id: row.id,
      title: row.title,
      answers: Number(row.answers),
      correctPct: Number(row.answers) > 0 ? Math.round((Number(row.correctAnswers) / Number(row.answers)) * 100) : null,
      averageMastery: num(row.averageMastery),
      studentsWithEvidence: Number(row.studentsWithEvidence),
    })),
    students: students.map((row) => ({
      id: row.id,
      displayName: row.displayName,
      submittedAttempts: Number(row.submittedAttempts),
      averageScorePct: num(row.averageScorePct),
      lastSubmittedAt: row.lastSubmittedAt,
    })),
  };
}
