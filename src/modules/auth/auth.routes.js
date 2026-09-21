// Dueño: EP-01 — Autenticación y Cuentas (HU-01 a HU-06). Alta/edición/baja de
// barberos (UC-22/23/24) vive en src/modules/barberos/ como módulo propio, para que
// el cliente pueda listarlos públicamente igual que /api/servicios.
import { Router } from 'express';
import * as controller from './auth.controller.js';
import { requireAuth } from '../../middlewares/auth.middleware.js';

const router = Router();

router.post('/register', controller.register);
router.post('/login', controller.login);
router.post('/verify-2fa', controller.verifyTwoFactor);
router.post('/forgot-password', controller.forgotPassword);
router.post('/reset-password', controller.resetPassword);
router.get('/me', requireAuth, controller.me);
router.put('/2fa', requireAuth, controller.updateTwoFactor);

export default router;
