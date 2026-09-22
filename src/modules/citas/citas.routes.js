// Dueño: EP-02 — Gestión de Citas (HU-07 a HU-11). El "proceso complejo" de la
// rúbrica de Fase 2 (cita atendida -> descuento de insumos -> alerta de stock bajo)
// vive en citas.service.js#marcarAtendida, que llama a inventario.service.js (EP-05)
// dentro de una transacción real — ver ese archivo para el detalle.
import { Router } from 'express';
import * as controller from './citas.controller.js';
import { requireAuth, requireRole } from '../../middlewares/auth.middleware.js';

const router = Router();

router.use(requireAuth);

router.post('/', requireRole('cliente'), controller.crear);
router.post('/walkin', requireRole('admin', 'barbero'), controller.crearWalkin);
router.get('/mias', requireRole('cliente'), controller.misCitas);
router.get('/', requireRole('admin', 'barbero'), controller.listar);

router.put('/:id/cancelar', controller.cancelar);
router.put('/:id/atender', requireRole('admin', 'barbero'), controller.marcarAtendida);
router.put('/:id', controller.reprogramar);

export default router;
