import 'dotenv/config';
import app from './app.js';
import { sequelize } from './config/database.js';
import { startBackgroundJobs } from './services/backgroundJobs.js';

// Inicia el servidor después de validar la base de datos.
const port = Number(process.env.PORT || 3001);
try {
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
  console.error('No se pudo conectar con MySQL:', error.message);
  process.exitCode = 1;
}
