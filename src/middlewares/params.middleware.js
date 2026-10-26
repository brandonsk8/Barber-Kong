// Validación compartida de los parámetros de ruta que son identificadores. Todos los ids
// del sistema son UUID generados por la app: uno mal formado se rechaza con 400 antes de
// llegar a PostgreSQL, que de otro modo fallaría con "invalid input syntax for type uuid"
// y respondería 500.
import { ApiError } from '../helpers/ApiError.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Nombres de parámetros de ruta que son UUID en todos los módulos.
export const PARAMS_UUID = ['id', 'ausenciaId', 'insumoId'];

// Firma de `router.param(nombre, fn)`.
export function validarUuid(req, res, next, valor) {
  if (!UUID.test(valor)) return next(ApiError.badRequest('El identificador no es válido.'));
  return next();
}
