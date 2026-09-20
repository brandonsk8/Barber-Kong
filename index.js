import { createApp } from './src/server/app.js';
import { pool } from './src/config/db.js';
import { logger } from './src/config/logger.js';

const PORT = process.env.PORT || 3000;

async function start() {
  await pool.query('SELECT 1');
  logger.info('Conexión a la base de datos establecida.');

  const app = await createApp();

  app.listen(PORT, () => {
    logger.info(`Barber Kong API escuchando en el puerto ${PORT}`);
  });
}

start().catch((err) => {
  logger.error('No se pudo iniciar el servidor.', { error: err.message, stack: err.stack });
  process.exit(1);
});
