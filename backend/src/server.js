import 'dotenv/config';
import app from './app.js';
import { sequelize } from './config/database.js';
import { startBackgroundJobs } from './services/backgroundJobs.js';
import { jwtSecret } from './utils/jwt.js';

// Inicia el servidor después de validar la base de datos.
const port = Number(process.env.PORT || 3001);
try {
  // Falla al arrancar (y no al primer inicio de sesión) si falta el secreto de JWT.
  jwtSecret();
  if (process.env.NODE_ENV === 'production' && !process.env.FRONTEND_ORIGIN) throw new Error('Configura FRONTEND_ORIGIN con la URL pública del frontend.');
  await sequelize.authenticate();
  const server = app.listen(port, () => console.log(`MENTOR AI API escuchando en puerto ${port}`));
  const stopJobs = startBackgroundJobs();
  // Al apagar, se libera el turno de tareas para que otra instancia lo tome sin esperar.
  for (const signal of ['SIGINT', 'SIGTERM']) {
    process.once(signal, async () => {
      await stopJobs();
      server.close(() => sequelize.close().finally(() => process.exit(0)));
    });
  }
} catch (error) {
  console.error('No se pudo iniciar MENTOR AI:', error.message);
  process.exitCode = 1;
}
