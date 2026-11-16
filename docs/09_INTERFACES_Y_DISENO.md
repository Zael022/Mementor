# Diseño de pantallas y experiencia de usuario

## Identidad visual
Producto profesional, moderno y académico (no infantil). Paleta sugerida azul profundo + turquesa/cian moderado + neutros claros/oscuros; alto contraste y componente principal de IA con indicador claro. Diseño responsive desde 360 px; sidebar en escritorio, navegación simplificada móvil, estados de carga, error y vacío.

## Rutas mínimas
**Público:** `/login`, `/recuperar-acceso` (si implementado), `/acerca-de`.
**Estudiante:** `/estudiante/inicio`, `/estudiante/cursos`, `/estudiante/cursos/:id`, `/estudiante/lecciones/:id`, `/estudiante/evaluaciones/:id`, `/estudiante/resultados/:attemptId`, `/estudiante/tutor/:courseId`, `/estudiante/progreso`, `/estudiante/plan`.
**Docente:** `/docente/inicio`, `/docente/cursos`, `/docente/cursos/:id/editar`, `/docente/cursos/:id/contenidos`, `/docente/cursos/:id/evaluaciones`, `/docente/cursos/:id/analitica`, `/docente/borradores-ia`.
**Admin institución:** `/admin/usuarios`, `/admin/cursos`, `/admin/docentes`, `/admin/auditoria`, `/admin/configuracion`.

## Pantallas clave
1. **Dashboard estudiante:** saludo, progreso por curso, habilidades (evidencia), siguiente acción, accesos rápidos y próximos objetivos.
2. **Curso:** módulos colapsables, ruta de temas, prerrequisitos visibles, lecciones publicadas, barra de avance que no confunda `avance completado` con `dominio`.
3. **Lección:** contenido legible, índice, ejercicios y acceso contextual al tutor.
4. **Evaluación:** temporización solo si la política lo requiere; paso a paso; persistencia de borrador si existe; confirmación de envío; accesible para teclado.
5. **Resultado:** score oficial de la práctica, aciertos/errores permitidos, explicación y recomendación; no mostrar respuestas de pruebas protegidas.
6. **Tutor IA:** chat contextual, burbuja con citas y enlaces a lecciones, aviso de posible error, botón `explica diferente`, `dame una pista`, `crear práctica` (cuando permitida).
7. **Planificador:** calendario/lista editable de sesiones y carga de trabajo razonable.
8. **Dashboard docente:** distribución de puntajes, dificultades por tema, evaluación con poca participación, borradores IA pendientes y tabla por estudiantes con permisos.
9. **Admin:** control de usuarios/institución, invitaciones, permisos y bitácora.

## Componentes reutilizables
`AppShell`, `Sidebar`, `Topbar`, `CourseCard`, `TopicProgress`, `MasteryMeter`, `RecommendationCard`, `LessonReader`, `QuestionCard`, `AssessmentResult`, `TutorChat`, `SourceCitation`, `StudyCalendar`, `DashboardKpi`, `DataTable`, `ConfirmDialog`, `EmptyState`, `Toast`, `LoadingSkeleton`, `ErrorBoundary`.

## Reglas UX
- No emojis como único indicador; acompañar íconos de etiquetas.
- Distinguir IA de datos verificados; etiquetar borradores, límites e incertidumbre.
- Mostrar `¿por qué esta recomendación?` con evidencia legible.
- No mostrar porcentajes falsos; dominar `n/a` cuando no hay evidencia.
- Respetar reduced-motion y accesibilidad; campos con labels, foco visible, buen contraste, aria-live para alertas.
- Las pantallas deben funcionar con datos reales del backend, no solo cards hardcodeadas. No crear seeds ni datos ficticios; si la API devuelve cero registros, mostrar `EmptyState` con la acción permitida correspondiente.
