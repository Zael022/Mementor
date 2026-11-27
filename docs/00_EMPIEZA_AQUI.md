# MENTOR AI — Paquete actualizado para Claude

**Versión:** 2.0 · **Objetivo:** React + Node/Express + MySQL + Sequelize + IA, código claro con comentarios breves, **sin datos precargados**.

Este paquete contiene un **prompt maestro**, documentación de producto, contratos técnicos y una **plantilla inicial de archivos** para respetar la estructura solicitada. La plantilla ejecuta una base mínima de frontend/backend; Claude debe desarrollar los módulos de MENTOR AI sobre ella. No es una aplicación educativa terminada.

## Cómo utilizarlo
1. Descomprimir `MENTOR_AI_CLAUDE_ACTUALIZADO.zip`.
2. Entregar a Claude la carpeta `DOCUMENTACION_Y_PROMPTS/` y, si se desea iniciar desde un proyecto base, `PLANTILLA_INICIAL/`.
3. Empezar con `01_PROMPT_MAESTRO_CLAUDE.md` y `15_REGLAS_ESTRUCTURA_Y_SIN_DATOS.md`.
4. Al usar Claude Code, copiar `DOCUMENTACION_Y_PROMPTS/CLAUDE.md` a la raíz del proyecto y conservar el resto de documentos disponibles.
5. Pedir que cree código real por fases y corra los tests. No se deben crear datos de ejemplo ni usuarios predeterminados.

## Estructura solicitada
Frontend: `Componentes`, `Pages`, `Rutas`, `App.jsx`, `main.jsx`, `index.html` (en la raíz `frontend/`). Backend: Node + Express y Sequelize ORM conectado a MySQL. `db.json` se utiliza únicamente como archivo de metadatos de conexión, nunca como almacenamiento.

## Entregables
Prompt maestro, visión de producto, roles, flujos, arquitectura, entidades, API, motor IA, UX, seguridad, roadmap, pruebas, prompts de continuación, guía de la estructura y plantilla mínima ejecutable.

## Regla importante
No hay currículo de ejemplo, seeds de contenido, mocks de alumnos ni métricas falsas. Las únicas cuentas de prueba son las del modo de prueba opcional (`DEMO_MODE=on`, ADR 0011). El repositorio inicia con la base de datos vacía. Las pruebas automatizadas, cuando Claude las agregue, usan un entorno aislado y no precargan el MySQL de desarrollo.
