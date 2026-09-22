import { ApiError } from '../../helpers/ApiError.js';

// Factory: recibe el repositorio como dependencia (no lo importa directo) para poder
// testear la lógica de negocio con un repositorio falso, sin tocar Postgres.
export function createServiciosService({ repository }) {
  return {
    async listActive() {
      return repository.findAllActive();
    },

    async getById(id) {
      const servicio = await repository.findById(id);
      if (!servicio) throw ApiError.notFound('Servicio no encontrado.');
      return servicio;
    },

    async create(data) {
      return repository.create(data);
    },

    async update(id, data) {
      const servicio = await repository.update(id, data);
      if (!servicio) throw ApiError.notFound('Servicio no encontrado.');
      return servicio;
    },

    async deactivate(id) {
      const servicio = await repository.setActive(id, false);
      if (!servicio) throw ApiError.notFound('Servicio no encontrado.');
      return servicio;
    },

    async activate(id) {
      const servicio = await repository.setActive(id, true);
      if (!servicio) throw ApiError.notFound('Servicio no encontrado.');
      return servicio;
    },

    // UC-13: qué insumos consume un servicio. citas.service.js (EP-02) lee esta misma
    // asociación en su propia transacción al marcar una cita como atendida — ver
    // inventario.service.js#descontarPorServicio.
    async listInsumos(servicioId) {
      await this.getById(servicioId);
      return repository.findInsumosDelServicio(servicioId);
    },

    async asociarInsumo(servicioId, { insumo_id, cantidad_consumida }) {
      await this.getById(servicioId);
      try {
        return await repository.asociarInsumo(servicioId, insumo_id, cantidad_consumida);
      } catch (err) {
        if (err.code === '23503') throw ApiError.badRequest('Ese insumo no existe.');
        throw err;
      }
    },

    async quitarInsumo(servicioId, insumoId) {
      await this.getById(servicioId);
      const eliminado = await repository.quitarInsumo(servicioId, insumoId);
      if (!eliminado) throw ApiError.notFound('Ese insumo no está asociado a este servicio.');
    },
  };
}
