// Dueño: EP-06 — Reportes (HU-22). Planeado para Sprint 3 / cierre de Fase 2.
// Implementar aquí: generación de reportes (citas, ingresos, consumo de insumos) con
// exportación a PDF y Excel (RF-REP-04). `exceljs` ya está en las dependencias para la
// parte de Excel; para PDF falta elegir librería (p. ej. pdfkit) cuando se llegue a esto.
import { Router } from 'express';
import { ApiError } from '../../helpers/ApiError.js';

const router = Router();

router.use((req, res, next) => next(ApiError.notFound('Reportes: pendiente de implementar (EP-06).')));

export default router;
