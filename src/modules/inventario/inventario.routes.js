// Dueño: EP-05 — Gestión de Inventario (HU-18/19 catálogo; HU-20/21 automatización).
// El descuento automático (UC-16) y la alerta de stock bajo (UC-17) viven en
// inventario.service.js (ver inventario.instance.js) y los reutiliza citas/ dentro de
// su propia transacción — no hay endpoint HTTP para eso acá.
import { Router } from 'express';
import * as controller from './inventario.controller.js';
import { requireAuth, requireRole } from '../../middlewares/auth.middleware.js';

const router = Router();

router.use(requireAuth, requireRole('admin'));

router.get('/', controller.list);
router.post('/', controller.create);
router.put('/:id', controller.update);
router.post('/:id/entrada', controller.registrarEntrada);

export default router;
