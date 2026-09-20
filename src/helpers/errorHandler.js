import { logger } from '../config/logger.js';

// Manejador de errores centralizado. Todos los módulos propagan errores con
// next(error) en vez de responder ellos mismos; este es el único lugar que decide el
// status/mensaje final. Errores 5xx se registran completos en la bitácora; nunca se
// exponen al cliente (podrían filtrar detalles internos).
// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  const status = err.status || 500;
  const message = status < 500 ? err.message : 'Ocurrió un error inesperado.';

  if (status >= 500) {
    logger.error(err.message, { stack: err.stack, path: req.path, method: req.method });
  } else {
    logger.warn(err.message, { path: req.path, method: req.method });
  }

  res.status(status).json({ message });
}
