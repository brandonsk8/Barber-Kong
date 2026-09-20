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
  };
}
