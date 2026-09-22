import { ApiError } from '../../helpers/ApiError.js';
import { notify } from '../../services/notification.service.js';

export function createInventarioService({ repository }) {
  return {
    async list() {
      return repository.findAll();
    },

    async getById(id) {
      const insumo = await repository.findById(id);
      if (!insumo) throw ApiError.notFound('Insumo no encontrado.');
      return insumo;
    },

    async create(data) {
      return repository.create(data);
    },

    async update(id, data) {
      const insumo = await repository.update(id, data);
      if (!insumo) throw ApiError.notFound('Insumo no encontrado.');
      return insumo;
    },

    async registrarEntrada(id, cantidad) {
      const insumo = await repository.registrarEntrada(id, cantidad);
      if (!insumo) throw ApiError.notFound('Insumo no encontrado.');
      return insumo;
    },

    // UC-16/UC-17 — llamada por citas.service.js dentro de su propia transacción
    // (mismo `client`) al marcar una cita como atendida. Descuenta cada insumo que
    // consume el servicio y devuelve los que quedaron con stock bajo (cantidad_minima
    // configurada y superada a la baja) para que el caller avise una vez que la
    // transacción ya se confirmó (no antes: si el COMMIT falla, no debe notificarse).
    async descontarPorServicio({ client, servicioId, citaId }) {
      const items = await repository.findServicioInsumosTx(client, servicioId);
      const alertas = [];
      for (const item of items) {
        const actualizado = await repository.descontarInsumoTx(
          client,
          item.insumo_id,
          item.cantidad_consumida,
          citaId
        );
        if (
          actualizado &&
          actualizado.cantidad_minima != null &&
          Number(actualizado.cantidad_disponible) < Number(actualizado.cantidad_minima)
        ) {
          alertas.push(actualizado);
        }
      }
      return alertas;
    },

    // Se llama después del COMMIT de la transacción de citas, una vez confirmado el
    // descuento. Notifica a todos los administradores activos (UC-17/UC-26).
    async notificarStockBajo(insumosConAlerta) {
      if (insumosConAlerta.length === 0) return;
      const admins = await repository.findAdminUsers();
      for (const insumo of insumosConAlerta) {
        for (const admin of admins) {
          await notify({
            userId: admin.id,
            email: admin.email,
            tipo: 'alerta_inventario',
            titulo: `Stock bajo: ${insumo.nombre}`,
            mensaje: `Quedan ${insumo.cantidad_disponible} ${insumo.unidad_medida || ''} de "${insumo.nombre}" (mínimo configurado: ${insumo.cantidad_minima}).`,
          });
        }
      }
    },
  };
}
