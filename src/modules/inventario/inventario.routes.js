// Dueño: EP-05 — Gestión de Inventario (HU-18/19 catálogo; HU-20/21 automatización)
// Seguir el patrón de src/modules/servicios/. Implementar aquí: registrar insumo,
// registrar reabastecimiento (INSERT en insumo_movimientos tipo 'entrada'). La función
// que descuenta insumos al atender una cita (UC-16) y evalúa la alerta de stock bajo
// (UC-17) debe exportarse desde inventario.service.js para que citas (EP-02) la
// reutilice sin duplicar lógica de negocio.
import { Router } from 'express';
import { ApiError } from '../../helpers/ApiError.js';

const router = Router();

router.use((req, res, next) => next(ApiError.notFound('Inventario: pendiente de implementar (EP-05).')));

export default router;
