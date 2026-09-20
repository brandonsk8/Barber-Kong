// Dueño: EP-01 — Autenticación y Cuentas (HU-01 a HU-06)
// Seguir el patrón de src/modules/servicios/ (routes/controller/service/repository/
// schema, SQL parametrizado a mano vía src/config/db.js, sin ORM).
// Implementar aquí: POST /login, POST /register, POST /verify-2fa, POST /forgot-password,
// POST /reset-password. Las rutas de alta/edición/baja de barberos (UC-22/23/24) pueden
// vivir en este mismo módulo o en uno propio (barberos), a criterio del dueño.
import { Router } from 'express';
import { ApiError } from '../../helpers/ApiError.js';

const router = Router();

router.use((req, res, next) => next(ApiError.notFound('Auth: pendiente de implementar (EP-01).')));

export default router;
