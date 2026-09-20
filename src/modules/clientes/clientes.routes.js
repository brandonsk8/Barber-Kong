// Dueño: EP-03 — Gestión de Clientes (HU-12 a HU-15). Todo bajo administración: el
// cliente autenticado gestiona su propia cuenta desde EP-01, no desde acá.
import { Router } from 'express';
import * as controller from './clientes.controller.js';
import { requireAuth, requireRole } from '../../middlewares/auth.middleware.js';

const router = Router();

router.use(requireAuth, requireRole('admin'));

router.get('/', controller.list);
router.get('/:id', controller.getOne);
router.get('/:id/historial', controller.historial);
router.post('/', controller.create);
router.put('/:id', controller.update);
router.put('/:id/activar', controller.activate);
router.delete('/:id', controller.deactivate);

export default router;
