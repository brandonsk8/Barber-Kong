// Dueño: EP-07 — Notificaciones (HU-23, centro de notificaciones in-app).
// El envío de correos (2FA, confirmaciones, alertas) ya tiene plomería lista en
// src/services/notification.service.js; cada módulo la usa para sus propios eventos.
// Este router es solo para que el usuario autenticado liste/marque como leídas sus
// notificaciones (UC-26) — SELECT/UPDATE simples sobre la tabla `notificaciones`.
import { Router } from 'express';
import { ApiError } from '../../helpers/ApiError.js';

const router = Router();

router.use((req, res, next) => next(ApiError.notFound('Notificaciones: pendiente de implementar (EP-07).')));

export default router;
