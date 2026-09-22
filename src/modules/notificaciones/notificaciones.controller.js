import * as repository from './notificaciones.repository.js';
import { createNotificacionesService } from './notificaciones.service.js';

const service = createNotificacionesService({ repository });

export async function list(req, res, next) {
  try {
    res.json(await service.list(req.user.id));
  } catch (err) {
    next(err);
  }
}

export async function markAsRead(req, res, next) {
  try {
    res.json(await service.markAsRead(req.params.id, req.user.id));
  } catch (err) {
    next(err);
  }
}
