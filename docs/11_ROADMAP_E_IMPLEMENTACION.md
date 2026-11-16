# Roadmap por fases — entregables y dependencias

## Fase 0: cimientos
- Monorepo, scripts, config, lint, testing, Docker Compose MySQL, migraciones, healthcheck, README y configuración sin registros.
- Hecho: clon limpio arranca en local con comandos claros y sin secretos.

## Fase 1: núcleo académico (MVP demostrable)
- Login, roles, institución creada por un administrador autorizado, cursos, docentes, matrículas, temas, lecciones, cuestionario de opción múltiple, puntuación, dominio y dashboard básico.
- Hecho: historia vertical del prompt maestro pasa prueba e2e/manual y API tests.

## Fase 2: tutor IA real (configurable)
- Adaptador para proveedor real, acceso por curso, recuperación de lecciones publicadas, respuestas con citas; después integración opcional con proveedor real y límites de costo.
- Hecho: tutor no cita material ajeno; explica con fuentes reales si hay clave y devuelve `AI_NOT_CONFIGURED` sin API key.

## Fase 3: personalización avanzada
- Recomendaciones explicables, prerrequisitos, sesiones de refuerzo y planificador editable según calendario, historial de dominio.
- Hecho: alumno con bajo rendimiento recibe práctica sobre la brecha correcta, alumno con buen rendimiento puede avanzar.

## Fase 4: soporte docente
- Analítica de curso y tema, generación de borradores IA con aprobación docente, exportaciones autorizadas.
- Hecho: docente revisa y publica material generado; no aparece contenido antes de aprobarse.

## Fase 5: endurecimiento y escalado
- Observabilidad, tests de carga, más instituciones, índice híbrido de materiales, upload PDF/DOCX seguro, backups, CI, despliegue.
- Hecho: aislamiento verificado con dos instituciones, backups probados y SLO iniciales.

## Priorización
**P0:** seguridad, cursos, evaluaciones, dominio y flujo end-to-end.
**P1:** tutor contextual con API configurada, recomendaciones, paneles.
**P2:** IA externa, generación docente y planes.
**P3:** integraciones, multimedia, mobile app y aprendizaje avanzado.

## Antipatrones a evitar
Hacer pantallas vacías sin endpoints; empezar por agente IA sin datos académicos; sobreingeniería con microservicios; almacenar toda la lógica en un solo controller; mezclar código de inventarios viejo; enseñar claves de examen al cliente; calcular dominio arbitrariamente por LLM.

## Plan de primera iteración
1. Validar entorno y dependencias.
2. Instalar DB local y migraciones.
3. Autenticación con sesiones/permisos.
4. Curso + asignación de docente + matrícula.
5. Módulo/tema/lección.
6. Cuestionario + submit + cálculo de score.
7. Actualizar dominio + recomendaciones.
8. Vistas mínimas docente/alumno.
9. Servicio tutor real con manejo explícito de proveedor no configurado.
10. Tests y documentación reproducibles.
