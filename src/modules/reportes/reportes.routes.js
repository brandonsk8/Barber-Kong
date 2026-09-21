// Dueño: EP-06 — Reportes (HU-22). Un único caso de uso (UC-18): el tipo de reporte y
// el formato de exportación son parámetros, no rutas distintas (los cuatro casos de uso
// originales -reporte de citas/ingresos/insumos y exportar- se consolidaron en uno).
import { Router } from 'express';
import * as controller from './reportes.controller.js';
import { requireAuth, requireRole } from '../../middlewares/auth.middleware.js';

const router = Router();

router.get('/', requireAuth, requireRole('admin'), controller.generar);

export default router;
