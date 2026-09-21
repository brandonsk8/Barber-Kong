import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { mountModules } from '../modules/index.js';
import { errorHandler } from '../helpers/errorHandler.js';
import { logger } from '../config/logger.js';

// Boot: index.js -> src/server/app.js. createApp() arma el express app y monta todos
// los módulos (auto-descubiertos por src/modules/index.js); index.js decide cuándo
// escuchar en el puerto.
export async function createApp() {
  const app = express();

  app.use(helmet());
  // exposedHeaders: por default el navegador no deja leer Content-Disposition desde
  // fetch() en una respuesta cross-origin aunque el servidor lo mande — sin esto, la
  // descarga de reportes (PDF/Excel) llega bien pero el frontend no puede leer el
  // nombre de archivo sugerido y cae al genérico "archivo".
  app.use(cors({ exposedHeaders: ['Content-Disposition'] }));
  app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev', {
    stream: { write: (message) => logger.http(message.trim()) },
  }));
  app.use(express.json());

  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok' });
  });

  await mountModules(app);

  app.use((req, res) => {
    res.status(404).json({ message: 'Ruta no encontrada.' });
  });

  app.use(errorHandler);

  return app;
}
