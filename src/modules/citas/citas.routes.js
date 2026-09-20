// Dueño: EP-02 — Gestión de Citas (HU-07 a HU-11)
// Seguir el patrón de src/modules/servicios/. Implementar aquí: agendar/reprogramar/
// cancelar cita, agenda del barbero, walk-in, y el endpoint de "marcar como atendida"
// que dispara el descuento automático de inventario (UC-16). Ese descuento vive en
// modules/inventario/inventario.service.js (dueño: EP-05) — llamarlo desde el
// controlador de citas dentro de una transacción (src/config/db.js#getClient), no
// duplicar la lógica aquí. Este es el "proceso complejo" de la rúbrica de Fase 2:
// cita atendida -> descuento de insumos -> alerta de stock bajo si aplica.
import { Router } from 'express';
import { ApiError } from '../../helpers/ApiError.js';

const router = Router();

router.use((req, res, next) => next(ApiError.notFound('Citas: pendiente de implementar (EP-02).')));

export default router;
