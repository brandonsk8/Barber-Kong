import { ApiError } from '../../helpers/ApiError.js';

export function createClientesService({ repository }) {
  return {
    async list(search, estado) {
      return repository.findAll(search, estado);
    },

    async getById(id) {
      const cliente = await repository.findById(id);
      if (!cliente) throw ApiError.notFound('Cliente no encontrado.');
      return cliente;
    },

    async create(data) {
      return repository.create(data);
    },

    async update(id, data) {
      const cliente = await repository.update(id, data);
      if (!cliente) throw ApiError.notFound('Cliente no encontrado.');
      return cliente;
    },

    async deactivate(id) {
      const cliente = await repository.setActive(id, false);
      if (!cliente) throw ApiError.notFound('Cliente no encontrado.');
      return cliente;
    },

    async activate(id) {
      const cliente = await repository.setActive(id, true);
      if (!cliente) throw ApiError.notFound('Cliente no encontrado.');
      return cliente;
    },

    async historial(id) {
      // Verifica que el cliente exista antes de consultar el historial (UC-10:
      // precondición "el cliente existe en el sistema").
      await this.getById(id);
      return repository.findHistorial(id);
    },
  };
}