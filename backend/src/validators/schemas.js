import { z } from 'zod';

// Define las reglas de los datos que recibe la API.
const text = (max, min = 1) => z.string().trim().min(min, 'Este campo es obligatorio.').max(max, `Máximo ${max} caracteres.`);
const id = z.number().int().positive();
const email = z.string().trim().toLowerCase().email('Correo no válido.').max(190);

export const loginSchema = z.object({ email, password: z.string().min(1).max(200) });
// La activación exige aceptar de forma explícita los términos y la política de privacidad.
const mustAccept = (message) => z.literal(true, { error: message });
export const activateSchema = z.object({
  token: z.string().trim().length(64),
  password: z.string().min(1).max(200),
  acceptTerms: mustAccept('Debes aceptar los términos y condiciones.'),
  acceptPrivacy: mustAccept('Debes aceptar la política de privacidad.'),
});

export const institutionSchema = z.object({ name: text(150, 2), slug: text(100).optional() });
export const inviteUserSchema = z.object({
  email,
  displayName: text(120, 2),
  role: z.enum(['institution_admin', 'teacher', 'student', 'auditor']),
});
export const inviteAdminSchema = z.object({ email, displayName: text(120, 2) });
export const updateUserSchema = z.object({
  displayName: text(120, 2).optional(),
  status: z.enum(['active', 'disabled']).optional(),
}).refine((data) => Object.keys(data).length > 0, 'No hay cambios.');

export const courseSchema = z.object({
  code: text(40).regex(/^[A-Za-z0-9._-]+$/, 'Usa solo letras, números, punto, guion o guion bajo.'),
  title: text(180, 2),
  description: z.string().trim().max(5000).optional(),
});
export const updateCourseSchema = z.object({
  title: text(180, 2).optional(),
  description: z.string().trim().max(5000).optional(),
  status: z.enum(['draft', 'published', 'archived']).optional(),
}).refine((data) => Object.keys(data).length > 0, 'No hay cambios.');
export const userRefSchema = z.object({ userId: id });
export const enrollSchema = z.object({ studentId: id });

export const moduleSchema = z.object({ title: text(180, 2) });
export const topicSchema = z.object({ title: text(180, 2), learningObjective: z.string().trim().max(500).optional() });
export const prerequisitesSchema = z.object({ prerequisiteTopicIds: z.array(id).max(20) });
const videoUrl = z.string().trim().max(500).nullable().optional();
export const lessonSchema = z.object({ title: text(180, 2), bodyMd: text(60000), videoUrl });
export const updateLessonSchema = z.object({
  title: text(180, 2).optional(),
  bodyMd: text(60000).optional(),
  videoUrl,
  status: z.enum(['draft', 'published']).optional(),
}).refine((data) => Object.keys(data).length > 0, 'No hay cambios.');

export const assessmentSchema = z.object({
  title: text(180, 2),
  topicId: id,
  passingScore: z.number().int().min(1).max(100).default(60),
  maxAttempts: z.number().int().min(1).max(20).default(3),
});
export const questionSchema = z.object({
  stem: text(4000, 3),
  explanation: z.string().trim().max(4000).optional(),
  points: z.number().int().min(1).max(100).default(1),
  topicId: id.optional(),
  options: z.array(z.object({ body: text(500), isCorrect: z.boolean() })).min(2, 'Agrega al menos dos opciones.').max(6),
}).refine((data) => data.options.filter((option) => option.isCorrect).length === 1, 'Debe haber exactamente una opción correcta.');
export const submitSchema = z.object({
  answers: z.array(z.object({ questionId: id, selectedOptionId: id })).max(200),
});

export const threadSchema = z.object({ title: z.string().trim().max(180).optional() });
export const tutorMessageSchema = z.object({ question: text(2000, 3), intent: z.enum(['hint', 'rephrase']).optional() });

// --- Aula: clases en vivo, anuncios, materiales, comentarios y tareas ---
const httpsUrl = z.string().trim().max(500).url('Enlace no válido.').refine((value) => value.startsWith('https://'), 'El enlace debe comenzar con https://');
const optionalId = id.nullable().optional();
const noChanges = (data) => Object.keys(data).length > 0;

const sessionFields = {
  title: text(180, 2),
  description: z.string().trim().max(2000).optional(),
  startsAt: z.coerce.date(),
  durationMinutes: z.number().int().min(10).max(480).default(60),
  meetingUrl: httpsUrl,
  topicId: optionalId,
};
export const sessionSchema = z.object(sessionFields);
export const updateSessionSchema = z.object({
  ...sessionFields,
  durationMinutes: z.number().int().min(10).max(480),
  status: z.enum(['scheduled', 'cancelled']),
  recordingUrl: httpsUrl.nullable(),
}).partial().refine(noChanges, 'No hay cambios.');

export const announcementSchema = z.object({ title: text(180, 2), body: text(5000) });
export const materialLinkSchema = z.object({ title: text(180, 2), url: httpsUrl, lessonId: optionalId });
export const commentSchema = z.object({ body: text(4000), parentId: optionalId });

const assignmentFields = {
  title: text(180, 2),
  instructions: text(20000),
  dueAt: z.coerce.date().nullable().optional(),
  maxPoints: z.number().int().min(1).max(1000).default(100),
  topicId: optionalId,
};
export const assignmentSchema = z.object(assignmentFields);
export const updateAssignmentSchema = z.object({
  ...assignmentFields,
  maxPoints: z.number().int().min(1).max(1000),
  status: z.enum(['draft', 'published']),
}).partial().refine(noChanges, 'No hay cambios.');
export const submissionSchema = z.object({ body: text(20000), linkUrl: httpsUrl.nullable().optional() });
export const gradeSchema = z.object({ gradePoints: z.number().int().min(0).max(1000), feedback: z.string().trim().max(5000).optional() });

// --- Fuentes del tutor, Drive y topes ---
const limit = z.number().int().min(0).max(1000000).nullable().optional();
export const institutionLimitsSchema = z.object({ maxDocuments: limit, aiDailyQuestionLimit: limit })
  .refine((data) => Object.keys(data).length > 0, 'No hay cambios.');
// Los identificadores de Drive solo tienen letras, números, guion y guion bajo.
const driveId = z.string().trim().min(10).max(128).regex(/^[A-Za-z0-9_-]+$/, 'El identificador de carpeta no es válido.');
export const driveFolderSchema = z.object({ folderId: driveId, label: text(180, 2) });
export const driveLinkSchema = z.object({ driveFolderId: id });

// Quizzes rápidos, práctica diaria y política de nota.
export const quickQuizSchema = z.object({
  title: text(180, 2),
  secondsPerQuestion: z.number().int().min(5, 'Mínimo 5 segundos.').max(120, 'Máximo 120 segundos.').default(20),
});
export const updateQuickQuizSchema = z.object({
  title: text(180, 2).optional(),
  secondsPerQuestion: z.number().int().min(5).max(120).optional(),
}).refine((data) => Object.keys(data).length > 0, 'No hay cambios.');
export const quickQuestionSchema = z.object({
  prompt: text(500, 3),
  options: z.array(z.object({ body: text(200), isCorrect: z.boolean() })).min(2, 'Agrega al menos dos opciones.').max(4, 'Máximo cuatro opciones.'),
});
export const quickAnswerSchema = z.object({ questionId: id, optionId: id.nullable() });
export const dailyAnswerSchema = z.object({ questionId: id, optionId: id });
const bonusValue = z.number().min(0).max(10).multipleOf(0.01, 'Usa como máximo dos decimales.');
export const gradePolicySchema = z.object({
  assessmentsWeight: z.number().int().min(0).max(100),
  assignmentsWeight: z.number().int().min(0).max(100),
  classworkWeight: z.number().int().min(0).max(100),
  quizBonus: bonusValue,
  streakDayBonus: bonusValue,
  bonusCap: bonusValue,
});
export const classWorkItemSchema = z.object({
  title: text(180, 2),
  maxPoints: z.number().int().min(1).max(1000).default(100),
  workDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha no válida.').nullable().optional(),
});
export const classWorkGradesSchema = z.object({
  grades: z.array(z.object({
    studentId: id,
    // null borra la calificación de ese estudiante.
    points: z.number().min(0).max(1000).multipleOf(0.01).nullable(),
    feedback: z.string().trim().max(1000).optional(),
  })).min(1).max(500),
});
// Datos personales propios: un texto vacío borra el dato opcional.
const optionalText = (max) => z.string().trim().max(max, `Máximo ${max} caracteres.`).optional();
export const profileSchema = z.object({
  displayName: text(120, 2).optional(),
  firstName: optionalText(80),
  lastName: optionalText(80),
  phone: z.string().trim().max(30).regex(/^$|^\+?[0-9 ()-]{6,30}$/, 'Usa solo números, espacios, guiones, paréntesis y un + inicial.').optional(),
  bio: optionalText(500),
}).strict().refine((data) => Object.keys(data).length > 0, 'No hay cambios.');
export const passwordChangeSchema = z.object({ currentPassword: z.string().min(1).max(200), newPassword: z.string().min(1).max(200) });
export const emailChangeSchema = z.object({ currentPassword: z.string().min(1).max(200), newEmail: email });

// --- Personalización ---
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Usa el formato AAAA-MM-DD.');
const timeZone = z.string().trim().min(1).max(64).regex(/^[A-Za-z0-9_+\-/]+$/, 'Zona horaria no válida.');
export const preferencesSchema = z.object({
  theme: z.enum(['system', 'light', 'dark']).optional(),
  textScale: z.union([z.literal(100), z.literal(115), z.literal(130), z.literal(150)]).optional(),
  highContrast: z.boolean().optional(),
  reducedMotion: z.boolean().optional(),
  readingSpacing: z.boolean().optional(),
  underlineLinks: z.boolean().optional(),
  timeZone: timeZone.nullable().optional(),
  dailyGoalMinutes: z.number().int().min(10).max(240).nullable().optional(),
  practiceSize: z.union([z.literal(5), z.literal(10), z.literal(15)]).optional(),
}).strict().refine((data) => Object.keys(data).length > 0, 'No hay cambios.');

export const selfReviewSchema = z.object({ grade: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]) });

export const studyPlanSchema = z.object({
  targetDate: day,
  minutesPerSession: z.number().int().min(15).max(240),
  studyDays: z.array(z.number().int().min(1).max(7)).min(1).max(7),
  timeZone: timeZone.optional(),
});
export const studyPlanItemSchema = z.object({
  status: z.enum(['pending', 'done', 'skipped']).optional(),
  scheduledDate: day.optional(),
  minutes: z.number().int().min(5).max(240).optional(),
}).refine((data) => Object.keys(data).length > 0, 'No hay cambios.');

// Recuperación de contraseña.
export const forgotPasswordSchema = z.object({ email: z.string().trim().toLowerCase().email('Correo no válido.').max(190) });
export const resetPasswordSchema = z.object({ token: z.string().regex(/^[a-f0-9]{64}$/, 'Enlace no válido.'), password: z.string().min(10).max(200) });

// Gobernanza de datos.
export const consentSchema = z.object({ documents: z.array(z.enum(['terms', 'privacy'])).min(1).max(2) });
export const deletionRequestSchema = z.object({
  password: z.string().min(1, 'Escribe tu contraseña para confirmar tu identidad.').max(200),
  reason: z.string().trim().max(500).optional(),
  confirm: z.literal(true, { error: 'Confirma que entiendes que la baja no se puede deshacer.' }),
});
