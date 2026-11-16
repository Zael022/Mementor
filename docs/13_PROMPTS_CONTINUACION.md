# Prompts para continuar con Claude

## Sesión posterior: continuar de donde quedamos
"Relee `CLAUDE.md`, el prompt maestro y la documentación del paquete. Inspecciona el repo actual y resume lo implementado y pendiente con evidencia de archivos/pruebas. Continúa con la **siguiente historia vertical** del roadmap. No rehagas módulos funcionales ni alteres migraciones aplicadas sin estrategia. Implementa, prueba y documenta."

## Mejorar el tutor IA
"Implementa el módulo tutor con contrato de proveedor real configurable desde backend. Primero garantiza autorización por institución/curso y recuperación exclusiva de lecciones publicadas; agrega citas reales, límite de tokens, audit metadata, rate limiting y tests que prueben no filtrar contenido de otros cursos. Si no hay API key, informa `AI_NOT_CONFIGURED`; no simules respuestas."

## Aprendizaje adaptativo
"Implementa `topic_mastery` y recomendaciones con fórmula explicable y tests de actualización, reintentos, falta de evidencia y prerrequisitos. No uses el LLM para calcular score. Conecta la lógica al panel estudiante y a analítica docente."

## Evaluaciones inteligentes
"Construye el flujo de generación de **borradores** de preguntas con IA basado en material de curso y JSON validado. Un docente asignado debe revisarlos y aprobarlos antes de publicación. Incluye auditoría y pruebas de permisos. No tocar calificaciones históricas."

## UX profesional
"Revisa todas las pantallas del rol estudiante y docente. Mejora estructura, responsive mobile, accesibilidad por teclado, textos en español, estados vacíos, loaders y errores reales. Mantén rutas y contratos existentes, sin mocks visuales disfrazados de datos reales."

## CI y despliegue
"Agrega pipeline de lint/test/build, archivos `.env.example` sin secretos, Docker Compose para dependencias locales, migraciones seguras, health checks, rate limiting y guía de despliegue. Evita modificar el entorno global, no publiques contraseñas."

## Auditoría de seguridad
"Haz una revisión focalizada en auth/session, CSRF, XSS/Markdown, IDOR, tenant isolation, filtración de claves de examen, upload y uso de IA. Crea pruebas explotando cada riesgo en un entorno de test y corrige hallazgos sin romper funcionalidades."
