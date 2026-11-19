import { sequelize } from '../config/database.js';
import { Institution } from './Institution.js';
import { User } from './User.js';
import { UserSession } from './UserSession.js';
import { Course, CourseTeacher, Enrollment } from './Course.js';
import { Module, Topic, TopicPrerequisite, Lesson, LessonProgress } from './Content.js';
import { Assessment, Question, QuestionOption, AssessmentAttempt, AttemptAnswer } from './Assessment.js';
import { TopicMastery, LearningRecommendation, AiThread, AiMessage, AuditLog } from './Learning.js';
import {
  ClassSession, SessionAttendance, Announcement, Material, LessonComment, Assignment, AssignmentSubmission,
} from './Classroom.js';
import {
  CourseRagCorpus, KnowledgeSource, SourceVersion, AiMessageSource, InstitutionDriveFolder, CourseDriveLink, AiUsageEvent,
} from './Knowledge.js';
import {
  CourseGradePolicy, ClassWorkItem, ClassWorkGrade, QuickQuiz, QuickQuizQuestion, QuickQuizOption, QuizPlay, QuizPlayAnswer,
  DailyPractice, DailyPracticeAnswer, CourseStreak, GradeBonusEvent,
} from './Gamification.js';

// Define las relaciones entre los modelos.
Institution.hasMany(User, { foreignKey: 'institutionId', as: 'users' });
User.belongsTo(Institution, { foreignKey: 'institutionId', as: 'institution' });
User.hasMany(UserSession, { foreignKey: 'userId', as: 'sessions' });
UserSession.belongsTo(User, { foreignKey: 'userId', as: 'user' });

Institution.hasMany(Course, { foreignKey: 'institutionId', as: 'courses' });
Course.belongsTo(Institution, { foreignKey: 'institutionId', as: 'institution' });
Course.belongsToMany(User, { through: CourseTeacher, foreignKey: 'courseId', otherKey: 'userId', as: 'teachers' });
User.belongsToMany(Course, { through: CourseTeacher, foreignKey: 'userId', otherKey: 'courseId', as: 'taughtCourses' });
Course.hasMany(Enrollment, { foreignKey: 'courseId', as: 'enrollments' });
Enrollment.belongsTo(Course, { foreignKey: 'courseId', as: 'course' });
Enrollment.belongsTo(User, { foreignKey: 'studentId', as: 'student' });

Course.hasMany(Module, { foreignKey: 'courseId', as: 'modules' });
Module.belongsTo(Course, { foreignKey: 'courseId', as: 'course' });
Module.hasMany(Topic, { foreignKey: 'moduleId', as: 'topics' });
Topic.belongsTo(Module, { foreignKey: 'moduleId', as: 'module' });
Topic.hasMany(Lesson, { foreignKey: 'topicId', as: 'lessons' });
Lesson.belongsTo(Topic, { foreignKey: 'topicId', as: 'topic' });
Topic.belongsToMany(Topic, { through: TopicPrerequisite, foreignKey: 'topicId', otherKey: 'prerequisiteTopicId', as: 'prerequisites' });
TopicPrerequisite.belongsTo(Topic, { foreignKey: 'topicId', as: 'topic' });
Lesson.hasMany(LessonProgress, { foreignKey: 'lessonId', as: 'progress' });

Course.hasMany(Assessment, { foreignKey: 'courseId', as: 'assessments' });
Assessment.belongsTo(Course, { foreignKey: 'courseId', as: 'course' });
Assessment.belongsTo(Topic, { foreignKey: 'topicId', as: 'topic' });
Assessment.hasMany(Question, { foreignKey: 'assessmentId', as: 'questions' });
Question.belongsTo(Assessment, { foreignKey: 'assessmentId', as: 'assessment' });
Question.hasMany(QuestionOption, { foreignKey: 'questionId', as: 'options' });
Assessment.hasMany(AssessmentAttempt, { foreignKey: 'assessmentId', as: 'attempts' });
AssessmentAttempt.belongsTo(Assessment, { foreignKey: 'assessmentId', as: 'assessment' });
AssessmentAttempt.belongsTo(User, { foreignKey: 'studentId', as: 'student' });
AssessmentAttempt.hasMany(AttemptAnswer, { foreignKey: 'attemptId', as: 'answers' });

TopicMastery.belongsTo(Topic, { foreignKey: 'topicId', as: 'topic' });
LearningRecommendation.belongsTo(Topic, { foreignKey: 'topicId', as: 'topic' });
LearningRecommendation.belongsTo(Topic, { foreignKey: 'nextTopicId', as: 'nextTopic' });
AiThread.hasMany(AiMessage, { foreignKey: 'threadId', as: 'messages' });
AiMessage.belongsTo(AiThread, { foreignKey: 'threadId', as: 'thread' });
AuditLog.belongsTo(User, { foreignKey: 'actorId', as: 'actor' });

ClassSession.belongsTo(Course, { foreignKey: 'courseId', as: 'course' });
ClassSession.hasMany(SessionAttendance, { foreignKey: 'sessionId', as: 'attendance' });
SessionAttendance.belongsTo(User, { foreignKey: 'studentId', as: 'student' });
Announcement.belongsTo(Course, { foreignKey: 'courseId', as: 'course' });
Announcement.belongsTo(User, { foreignKey: 'authorId', as: 'author' });
Material.belongsTo(Lesson, { foreignKey: 'lessonId', as: 'lesson' });
LessonComment.belongsTo(User, { foreignKey: 'authorId', as: 'author' });
Assignment.belongsTo(Course, { foreignKey: 'courseId', as: 'course' });
Assignment.hasMany(AssignmentSubmission, { foreignKey: 'assignmentId', as: 'submissions' });
AssignmentSubmission.belongsTo(Assignment, { foreignKey: 'assignmentId', as: 'assignment' });
AssignmentSubmission.belongsTo(User, { foreignKey: 'studentId', as: 'student' });

// Fuentes del tutor, versiones, Drive y consumo.
Course.hasOne(CourseRagCorpus, { foreignKey: 'courseId', as: 'ragCorpus' });
KnowledgeSource.belongsTo(Course, { foreignKey: 'courseId', as: 'course' });
KnowledgeSource.belongsTo(Lesson, { foreignKey: 'lessonId', as: 'lesson' });
KnowledgeSource.belongsTo(Material, { foreignKey: 'materialId', as: 'material' });
KnowledgeSource.belongsTo(CourseDriveLink, { foreignKey: 'driveLinkId', as: 'driveLink' });
KnowledgeSource.hasMany(SourceVersion, { foreignKey: 'sourceId', as: 'versions' });
KnowledgeSource.belongsTo(SourceVersion, { foreignKey: 'activeVersionId', as: 'activeVersion', constraints: false });
SourceVersion.belongsTo(KnowledgeSource, { foreignKey: 'sourceId', as: 'source' });
AiMessageSource.belongsTo(SourceVersion, { foreignKey: 'sourceVersionId', as: 'version' });
AiMessageSource.belongsTo(KnowledgeSource, { foreignKey: 'sourceId', as: 'source' });
AiMessage.hasMany(AiMessageSource, { foreignKey: 'messageId', as: 'sourceLinks' });
CourseDriveLink.belongsTo(InstitutionDriveFolder, { foreignKey: 'driveFolderId', as: 'folder' });
CourseDriveLink.belongsTo(Course, { foreignKey: 'courseId', as: 'course' });
Material.hasOne(KnowledgeSource, { foreignKey: 'materialId', as: 'knowledgeSource' });

// Quizzes rápidos, racha y bono de nota.
Course.hasOne(CourseGradePolicy, { foreignKey: 'courseId', as: 'gradePolicy' });
ClassWorkItem.hasMany(ClassWorkGrade, { foreignKey: 'itemId', as: 'grades' });
QuickQuiz.belongsTo(Course, { foreignKey: 'courseId', as: 'course' });
QuickQuiz.hasMany(QuickQuizQuestion, { foreignKey: 'quizId', as: 'questions' });
QuickQuizQuestion.belongsTo(QuickQuiz, { foreignKey: 'quizId', as: 'quiz' });
QuickQuizQuestion.hasMany(QuickQuizOption, { foreignKey: 'questionId', as: 'options' });
QuickQuiz.hasMany(QuizPlay, { foreignKey: 'quizId', as: 'plays' });
QuizPlay.belongsTo(QuickQuiz, { foreignKey: 'quizId', as: 'quiz' });
QuizPlay.belongsTo(User, { foreignKey: 'studentId', as: 'student' });
QuizPlay.hasMany(QuizPlayAnswer, { foreignKey: 'playId', as: 'answers' });
DailyPractice.hasMany(DailyPracticeAnswer, { foreignKey: 'practiceId', as: 'answers' });

export {
  CourseRagCorpus, KnowledgeSource, SourceVersion, AiMessageSource, InstitutionDriveFolder, CourseDriveLink, AiUsageEvent,
  ClassSession, SessionAttendance, Announcement, Material, LessonComment, Assignment, AssignmentSubmission,
  sequelize, Institution, User, UserSession, Course, CourseTeacher, Enrollment,
  Module, Topic, TopicPrerequisite, Lesson, LessonProgress,
  Assessment, Question, QuestionOption, AssessmentAttempt, AttemptAnswer,
  TopicMastery, LearningRecommendation, AiThread, AiMessage, AuditLog,
  CourseGradePolicy, ClassWorkItem, ClassWorkGrade, QuickQuiz, QuickQuizQuestion, QuickQuizOption, QuizPlay, QuizPlayAnswer,
  DailyPractice, DailyPracticeAnswer, CourseStreak, GradeBonusEvent,
};
