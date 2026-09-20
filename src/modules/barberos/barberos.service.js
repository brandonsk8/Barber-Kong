import bcrypt from 'bcrypt';
import { ApiError } from '../../helpers/ApiError.js';

const SALT_ROUNDS = 10;

// Franja de atención por defecto (9:00-19:00, receso 13:00-14:00 excluido acá porque
// el frontend ya lo bloquea localmente) — se usa solo para expandir qué horas de una
// hora de duración quedan cubiertas por una cita ya agendada.
function slotsCubiertos(horaInicio, horaFin) {
  const start = Number(horaInicio.slice(0, 2));
  const end = Number(horaFin.slice(0, 2));
  const endMinutes = Number(horaFin.slice(3, 5));
  const slots = [];
  for (let h = start; h < end || (h === end && endMinutes > 0 && h === start); h += 1) {
    slots.push(`${String(h).padStart(2, '0')}:00`);
  }
  return slots.length ? slots : [horaInicio.slice(0, 5)];
}

export function createBarberosService({ repository }) {
  return {
    async listActive() {
      return repository.findAllActive();
    },

    async listAll() {
      return repository.findAll();
    },

    async getById(id) {
      const barbero = await repository.findById(id);
      if (!barbero) throw ApiError.notFound('Barbero no encontrado.');
      return barbero;
    },

    // Usado por auth.service.js para enriquecer el JWT/perfil de un usuario con role
    // 'barbero' con el id de su fila en `barberos` (distinto del id de `users`), que es
    // el que citas.service.js espera como barbero_id.
    async getByUserId(userId) {
      return repository.findByUserId(userId);
    },

    async create({ nombre, especialidad, email, password }) {
      const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
      try {
        return await repository.createWithUser({ nombre, especialidad, email, passwordHash });
      } catch (err) {
        if (err.code === '23505') throw ApiError.conflict('Ya existe una cuenta con ese correo.');
        throw err;
      }
    },

    async update(id, data) {
      const barbero = await repository.update(id, data);
      if (!barbero) throw ApiError.notFound('Barbero no encontrado.');
      return barbero;
    },

    async deactivate(id) {
      const barbero = await repository.setActive(id, false);
      if (!barbero) throw ApiError.notFound('Barbero no encontrado.');
      return barbero;
    },

    async activate(id) {
      const barbero = await repository.setActive(id, true);
      if (!barbero) throw ApiError.notFound('Barbero no encontrado.');
      return barbero;
    },

    async getDisponibilidad(barberoId, fecha) {
      await this.getById(barberoId);
      const citas = await repository.findCitasDelDia(barberoId, fecha);
      const ocupadas = new Set();
      citas.forEach((c) => {
        slotsCubiertos(c.hora_inicio, c.hora_fin).forEach((s) => ocupadas.add(s));
      });
      return { ocupadas: Array.from(ocupadas).sort() };
    },
  };
}
