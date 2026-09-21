// Dueño: EP-04 — Gestión de Servicios (HU-16, HU-17). Módulo de referencia: usar este
// patrón (routes/controller/service/repository/schema) para el resto de módulos.
import { Router } from 'express';
import * as controller from './servicios.controller.js';
import { requireAuth, requireRole } from '../../middlewares/auth.middleware.js';

const router = Router();

// Catálogo público (RF-SER-03: el cliente debe verlo al agendar, sin necesidad de login).
router.get('/', controller.list);
router.get('/:id', controller.getOne);

// Mantenimiento del catálogo: solo administrador (RF-SER-01).
router.post('/', requireAuth, requireRole('admin'), controller.create);
router.put('/:id', requireAuth, requireRole('admin'), controller.update);
router.delete('/:id', requireAuth, requireRole('admin'), controller.deactivate);

// UC-13 — insumos que consume el servicio. Esta asociación es la que usa
// inventario.service.js#descontarPorServicio al marcar una cita como atendida.
router.get('/:id/insumos', requireAuth, requireRole('admin'), controller.listInsumos);
router.post('/:id/insumos', requireAuth, requireRole('admin'), controller.asociarInsumo);
router.delete('/:id/insumos/:insumoId', requireAuth, requireRole('admin'), controller.quitarInsumo);

export default router;
