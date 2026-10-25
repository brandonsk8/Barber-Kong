// Punto de entrada para Vercel (funciones serverless). `index.js` en la raíz del repo
// sigue siendo el que se usa en local y en Docker (hace app.listen() en un puerto fijo);
// acá reusamos el mismo createApp() pero sin escuchar un puerto propio — Vercel invoca
// este handler una vez por cada request entrante y nosotros simplemente le pasamos
// req/res al app de Express (Express ya sabe responder como un handler de Node normal).
import { createApp } from '../src/server/app.js';
import { pool } from '../src/config/db.js';
import { logger } from '../src/config/logger.js';

// Se cachea entre invocaciones de la misma instancia de función (Vercel reusa procesos
// "calientes" cuando puede), así no se reconstruye el app de Express ni se vuelve a
// montar todos los módulos en cada request.
let appPromise;

async function getApp() {
  if (!appPromise) {
    appPromise = (async () => {
      await pool.query('SELECT 1');
      logger.info('Conexión a la base de datos establecida (Vercel).');
      return createApp();
    })();
  }
  return appPromise;
}

export default async function handler(req, res) {
  const app = await getApp();
  return app(req, res);
}
