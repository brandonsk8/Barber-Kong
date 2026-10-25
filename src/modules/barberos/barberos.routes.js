// Alta/edición/baja de barberos (UC-22/23/24). Módulo propio (en vez de vivir dentro
// de auth/) para que el cliente pueda listar barberos activos públicamente al agendar,
// igual que /api/servicios.
import { Router } from 'express';
import * as controller from './barberos.controller.js';
import { requireAuth, requireRole } from '../../middlewares/auth.middleware.js';

const router = Router();

router.get('/', controller.list);
router.get('/admin', requireAuth, requireRole('admin'), controller.listAll);
router.get('/:id', controller.getOne);
router.get('/:id/horario', controller.getHorario);
router.get('/:id/disponibilidad', controller.getDisponibilidad);

router.post('/', requireAuth, requireRole('admin'), controller.create);
router.put('/:id', requireAuth, requireRole('admin'), controller.update);
router.delete('/:id', requireAuth, requireRole('admin'), controller.deactivate);

// Días en que el barbero no estará disponible. Los puede gestionar el administrador o el
// propio barbero (el service verifica que sea SU agenda, no la de otro).
router.get('/:id/ausencias', requireAuth, requireRole('admin', 'barbero'), controller.listAusencias);
router.post('/:id/ausencias', requireAuth, requireRole('admin', 'barbero'), controller.crearAusencia);
router.delete('/:id/ausencias/:ausenciaId', requireAuth, requireRole('admin', 'barbero'), controller.quitarAusencia);

export default router;
