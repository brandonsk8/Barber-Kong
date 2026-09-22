import { ApiError } from '../../helpers/ApiError.js';

export function createNotificacionesService({ repository }) {
  return {
    async list(userId) {
      return repository.findByUserId(userId);
    },

    async markAsRead(id, userId) {
      const notificacion = await repository.findById(id);
      if (!notificacion) throw ApiError.notFound('Notificación no encontrada.');
      if (notificacion.user_id !== userId) {
        throw ApiError.forbidden('No tienes permiso sobre esta notificación.');
      }
      return repository.markAsRead(id);
    },
  };
}
