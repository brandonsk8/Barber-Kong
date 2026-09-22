// EP-01 — Autenticación y Cuentas. Lee el header Authorization: Bearer <token>, valida
// el JWT (jsonwebtoken.verify con JWT_SECRET) y adjunta el payload a req.user. Cualquier
// otro módulo (citas, clientes, inventario...) importa esto tal cual:
// import { requireAuth, requireRole } from '../../middlewares/auth.middleware.js'
import jwt from 'jsonwebtoken';
import { ApiError } from '../helpers/ApiError.js';

export function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return next(ApiError.unauthorized('Debes iniciar sesión para continuar.'));
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    // payload: { id, email, role } (ver auth.service.js#issueToken)
    req.user = payload;
    return next();
  } catch {
    return next(ApiError.unauthorized('Tu sesión expiró o no es válida. Ingresá de nuevo.'));
  }
}

// RNF-SEG-02: cada endpoint valida el rol en el backend, no solo en el frontend/UI.
export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return next(ApiError.unauthorized('Debes iniciar sesión para continuar.'));
    if (!roles.includes(req.user.role)) {
      return next(ApiError.forbidden('No tienes permiso para esta acción.'));
    }
    return next();
  };
}
