import { ApiError } from '../helpers/ApiError.js';

// TODO (EP-01 — Autenticación y Cuentas): implementar de verdad.
// requireAuth: leer el header Authorization: Bearer <token>, validar el JWT
// (jsonwebtoken.verify con JWT_SECRET) y adjuntar el payload a req.user.
// requireRole: comparar req.user.role contra la lista permitida (RNF-SEG-02: cada
// endpoint valida el rol en el backend, no solo en el frontend/UI).
// Cualquier otro módulo (citas, clientes, inventario...) importa esto tal cual:
// import { requireAuth, requireRole } from '../../middlewares/auth.middleware.js'

export function requireAuth(req, res, next) {
  next(ApiError.unauthorized('Auth: pendiente de implementar (EP-01).'));
}

export function requireRole(...roles) {
  // eslint-disable-next-line no-unused-vars
  return (req, res, next) => {
    next(ApiError.forbidden(`Auth: pendiente de implementar (EP-01). Roles esperados: ${roles.join(', ')}`));
  };
}
