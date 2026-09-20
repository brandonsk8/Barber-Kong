// Dueño: EP-03 — Gestión de Clientes (HU-12 a HU-15)
// Seguir el patrón de src/modules/servicios/. Implementar aquí: registrar cliente
// (walk-in/sin cuenta), buscar/filtrar, historial, editar/desactivar.
import { Router } from 'express';
import { ApiError } from '../../helpers/ApiError.js';

const router = Router();

router.use((req, res, next) => next(ApiError.notFound('Clientes: pendiente de implementar (EP-03).')));

export default router;
