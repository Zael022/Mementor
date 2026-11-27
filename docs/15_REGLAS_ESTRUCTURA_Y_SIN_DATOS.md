# Especificación prioritaria — estructura, Sequelize y ausencia de datos ficticios

## Estructura frontend requerida por el usuario

```text
frontend/
├── index.html                  # HTML raíz de Vite
├── package.json
├── src/
│   ├── Componentes/           # Elementos reutilizables
│   ├── Pages/                 # Pantallas completas
│   ├── Rutas/                 # Definición y protección de rutas
│   │   └── Rutas.jsx
│   ├── App.jsx                # Monta las rutas y el diseño principal
│   ├── main.jsx               # Entrada de React
│   ├── services/              # Cliente HTTP para backend
│   └── styles.css
└── public/
```

**Orden de carga:** `frontend/index.html` contiene `#root` y apunta a `/src/main.jsx`; `main.jsx` renderiza `App.jsx`; `App.jsx` monta `Rutas/Rutas.jsx`; las rutas montan pantallas de `Pages/`; las páginas componen elementos de `Componentes/`. No anidar `index.html` dentro de `main` ni de `src` porque Vite lo espera en su raíz.

## Estructura backend

```text
backend/
├── config/db.json              # Mapa de variables de entorno; no credenciales
├── database/migrations/       # Sequelize CLI (solo esquema) CLI
├── src/
│   ├── app.js
│   ├── server.js
│   ├── config/database.js
│   ├── models/
│   ├── controllers/
│   ├── services/
│   ├── routes/
│   ├── middlewares/
│   ├── validators/
│   └── utils/
├── tests/
└── .env.example
```

Persistencia real **MySQL + Sequelize** (en la rama `despliegue-nube`, también PostgreSQL de Supabase para publicar; ADR 0012). `db.json` NO guarda cursos, contraseñas, estudiantes ni registros: solo metadatos de conexión como nombres de variables `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`. El adaptador Sequelize lee valores reales de `.env` de forma segura. No publicar credenciales.

## Sin datos de prueba precargados
- Excepción: cuentas de prueba por rol con el modo de prueba (`DEMO_MODE=on`, ADR 0011). Se marcan con `users.is_demo`, se crean al arrancar o con `npm run demo:cuentas` y solo entran con el modo encendido.
- No crear `seed.js`, `seeders/`, `curriculo_demo.json`, `db.json` con datos académicos, JSON Server, Faker, ejemplos de alumnos o perfiles precargados.
- No inventar estadística de cursos, notas, usuarios, tendencias ni recomendaciones en el frontend: si MySQL devuelve cero filas, mostrar un estado vacío bien diseñado.
- Al ejecutar migraciones se crean tablas, FKs e índices; la BD permanece sin filas de contenido hasta que personas autorizadas creen registros mediante la app.
- Primer administrador: flujo setup protegido de un solo uso, o comando de provisionamiento que exige correo y contraseña segura introducidos por el administrador; no contraseña hardcodeada ni seed.
- Pruebas de código pueden crear sus propios registros aislados y efímeros en **otra base de datos**, limpiándolos luego. Esto no implica precarga de contenido de MENTOR AI.
- IA: servicio real configurado por el operador; ausencia de token → error explicativo en el tutor, **no** respuesta simulada.

## Calidad y comentarios
- Código JavaScript/JSX con separación por responsabilidad; evitar componentes gigantes, lógica de DB en rutas y estado duplicado.
- ORM Sequelize con `models`, `associations`, `migrations`, manejo de transacciones e índices; evitar `sequelize.sync({force:true})` en sistemas persistentes.
- Comentarios breves y generales en español cuando aporten contexto; no comentarios línea a línea, no tutoriales largos dentro de archivos.
- Ejemplos válidos: `// Maneja la sesión del usuario.`, `// Consulta los cursos disponibles.`, `// Verifica el estado de la base de datos.`.
- Priorizar buenas prácticas sobre usar técnicas complejas innecesarias.

## Comportamiento de arranque
1. `npm install` instala dependencias.
2. Configurar `.env` sin secretos compartidos.
3. Crear MySQL vacío y ejecutar `sequelize-cli db:migrate`.
4. Arrancar backend y frontend por separado.
5. Visitar app: páginas vacías con CTA de crear cuenta/institución bajo flujo seguro; ningún curso ni estudiante precargado.
