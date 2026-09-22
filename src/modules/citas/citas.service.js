import { ApiError } from '../../helpers/ApiError.js';
import { getClient } from '../../config/db.js';
import { notify } from '../../services/notification.service.js';
import { inventarioService } from '../inventario/inventario.instance.js';

function addMinutes(hhmm, minutes) {
  const [h, m] = hhmm.split(':').map(Number);
  const total = h * 60 + m + minutes;
  const hh = String(Math.floor(total / 60) % 24).padStart(2, '0');
  const mm = String(total % 60).padStart(2, '0');
  return `${hh}:${mm}`;
}

function hoyISO() {
  return new Date().toISOString().slice(0, 10);
}

export function createCitasService({ repository }) {
  async function validarDisponibilidad({ barberoId, servicioId, fecha, horaInicio, excludeCitaId }) {
    if (fecha < hoyISO()) throw ApiError.badRequest('No se puede agendar en una fecha pasada.');

    const servicio = await repository.findServicioById(servicioId);
    if (!servicio || !servicio.is_active) throw ApiError.notFound('Servicio no encontrado.');

    const barbero = await repository.findBarberoById(barberoId);
    if (!barbero || !barbero.is_active) throw ApiError.notFound('Barbero no encontrado.');

    const horaFin = addMinutes(horaInicio, servicio.duracion_minutos);

    const solapa = await repository.existeSolapamiento(barberoId, fecha, horaInicio, horaFin, excludeCitaId);
    if (solapa) throw ApiError.conflict('Ese horario ya no está disponible. Elegí otro.');

    return { servicio, barbero, horaFin };
  }

  async function assertPuedeGestionar(cita, requester) {
    if (requester.role === 'admin' || requester.role === 'barbero') return;
    const cliente = await repository.findClienteByUserId(requester.id);
    if (cliente && cita.cliente_id === cliente.id) return;
    throw ApiError.forbidden('No tienes permiso sobre esta cita.');
  }

  return {
    async crear({ userId, servicioId, barberoId, fecha, horaInicio }) {
      const cliente = await repository.findClienteByUserId(userId);
      if (!cliente) throw ApiError.badRequest('No se encontró tu perfil de cliente.');

      const { servicio, barbero, horaFin } = await validarDisponibilidad({
        barberoId,
        servicioId,
        fecha,
        horaInicio,
      });

      const cita = await repository.create({
        clienteId: cliente.id,
        barberoId,
        servicioId,
        fecha,
        horaInicio,
        horaFin,
        esWalkin: false,
        estado: 'confirmada',
      });

      if (cliente.correo) {
        await notify({
          userId,
          email: cliente.correo,
          tipo: 'confirmacion_cita',
          titulo: 'Cita confirmada — Barber Kong',
          mensaje: `Tu cita de "${servicio.nombre}" con ${barbero.nombre} quedó confirmada para el ${fecha} a las ${horaInicio}.`,
        });
      }

      return cita;
    },

    async crearWalkin({ barberoId, servicioId, fecha, horaInicio, nombreCliente }) {
      const { horaFin } = await validarDisponibilidad({ barberoId, servicioId, fecha, horaInicio });

      // Si dan un nombre, se registra un cliente walk-in (sin cuenta, UC-08/UC-25) para
      // que la cita quede identificada en la agenda del barbero; si no, queda anónima.
      const cliente = nombreCliente ? await repository.createClienteWalkin(nombreCliente) : null;

      return repository.create({
        clienteId: cliente?.id || null,
        barberoId,
        servicioId,
        fecha,
        horaInicio,
        horaFin,
        esWalkin: true,
        estado: 'confirmada',
      });
    },

    async misCitas(userId) {
      const cliente = await repository.findClienteByUserId(userId);
      if (!cliente) return [];
      return repository.findMiasByClienteId(cliente.id);
    },

    async reprogramar(id, { fecha, horaInicio }, requester) {
      const cita = await repository.findById(id);
      if (!cita) throw ApiError.notFound('Cita no encontrada.');
      await assertPuedeGestionar(cita, requester);
      if (cita.estado === 'cancelada' || cita.estado === 'atendida') {
        throw ApiError.conflict('Esta cita ya no se puede reprogramar.');
      }

      const { horaFin } = await validarDisponibilidad({
        barberoId: cita.barbero_id,
        servicioId: cita.servicio_id,
        fecha,
        horaInicio,
        excludeCitaId: id,
      });

      const actualizada = await repository.updateFechaHora(id, { fecha, horaInicio, horaFin });

      if (cita.cliente_id) {
        const cliente = await repository.findClienteByUserId(requester.id);
        if (cliente?.correo) {
          await notify({
            userId: requester.id,
            email: cliente.correo,
            tipo: 'reprogramacion_cita',
            titulo: 'Cita reprogramada — Barber Kong',
            mensaje: `Tu cita de "${cita.servicio_nombre}" quedó reprogramada para el ${fecha} a las ${horaInicio}.`,
          });
        }
      }

      return actualizada;
    },

    async cancelar(id, requester) {
      const cita = await repository.findById(id);
      if (!cita) throw ApiError.notFound('Cita no encontrada.');
      await assertPuedeGestionar(cita, requester);
      if (cita.estado === 'cancelada') return cita;
      if (cita.estado === 'atendida') throw ApiError.conflict('Esta cita ya fue atendida, no se puede cancelar.');

      const actualizada = await repository.setEstado(id, 'cancelada');

      if (cita.cliente_id) {
        const cliente = await repository.findClienteByUserId(requester.id);
        if (cliente?.correo) {
          await notify({
            userId: requester.id,
            email: cliente.correo,
            tipo: 'cancelacion_cita',
            titulo: 'Cita cancelada — Barber Kong',
            mensaje: `Tu cita de "${cita.servicio_nombre}" del ${cita.fecha} a las ${cita.hora_inicio} fue cancelada.`,
          });
        }
      }

      return actualizada;
    },

    // El "proceso complejo" de la rúbrica de Fase 2 (UC-16/UC-17): marcar la cita como
    // atendida y descontar inventario deben confirmarse juntos o ninguno de los dos, así
    // que corren en una sola transacción real (BEGIN/COMMIT/ROLLBACK), no dos queries
    // sueltas. El descuento en sí vive en inventario.service.js (dueño: EP-05); acá solo
    // se orquesta la transacción y se llama a esa función, sin duplicar la lógica.
    async marcarAtendida(id) {
      const cita = await repository.findById(id);
      if (!cita) throw ApiError.notFound('Cita no encontrada.');
      if (cita.estado === 'atendida') return cita;
      if (cita.estado === 'cancelada') throw ApiError.conflict('Una cita cancelada no se puede marcar como atendida.');

      const client = await getClient();
      let alertas = [];
      try {
        await client.query('BEGIN');
        await repository.setEstadoTx(client, id, 'atendida');
        alertas = await inventarioService.descontarPorServicio({
          client,
          servicioId: cita.servicio_id,
          citaId: id,
        });
        await client.query('COMMIT');
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }

      // Solo se notifica una vez que la transacción ya quedó confirmada.
      await inventarioService.notificarStockBajo(alertas);

      return repository.findById(id);
    },

    async agendaDelDia(barberoId, fecha) {
      return repository.findByBarberoYFecha(barberoId, fecha);
    },

    async listarPorRango({ desde, hasta, barberoId }) {
      return repository.findByRango({ desde: desde || hoyISO(), hasta: hasta || hoyISO(), barberoId });
    },
  };
}
