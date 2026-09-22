// Dueño: EP-07 — Notificaciones (HU-23, centro de notificaciones in-app, UC-26).
// El envío de correos (2FA, confirmaciones, alertas) ya tiene plomería lista en
// src/services/notification.service.js; cada módulo la usa para sus propios eventos.
// Este router es solo para que el usuario autenticado liste/marque como leídas las
// suyas — cualquier rol, cada quien ve únicamente lo propio (user_id del JWT).
import { Router } from 'express';
import * as controller from './notificaciones.controller.js';
import { requireAuth } from '../../middlewares/auth.middleware.js';

const router = Router();

router.use(requireAuth);

router.get('/', controller.list);
router.put('/:id/leer', controller.markAsRead);

export default router;
