import { ApiError } from '../../helpers/ApiError.js';

export function createClientesService({ repository }) {
  return {
    async list(search) {
      return repository.findAll(search);
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
  };
}
