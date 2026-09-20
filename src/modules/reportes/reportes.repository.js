// Único lugar con acceso a datos de este módulo. SQL parametrizado a mano, sin ORM.
// Los tres reportes leen de tablas que ya llenan otros módulos (citas, insumo_movimientos)
// — este módulo no escribe nada, solo agrega y da formato.
import { query } from '../../config/db.js';

// RF-REP-01: citas por rango de fechas, con su estado actual (confirmada/cancelada/
// atendida). El esquema no guarda un estado "reprogramada" aparte -- reprogramar solo
// actualiza fecha/hora de la misma cita -- así que ese caso se refleja como una cita
// confirmada cuya fecha ya no es la de creación, no como un estado propio.
export async function citasPorRango(desde, hasta) {
  const { rows } = await query(
    `SELECT ci.fecha, ci.hora_inicio, ci.estado, ci.es_walkin,
            s.nombre AS servicio, b.nombre AS barbero,
            COALESCE(c.nombre, 'Walk-in') AS cliente
     FROM citas ci
     JOIN servicios s ON s.id = ci.servicio_id
     JOIN barberos b ON b.id = ci.barbero_id
     LEFT JOIN clientes c ON c.id = ci.cliente_id
     WHERE ci.fecha BETWEEN $1 AND $2
     ORDER BY ci.fecha, ci.hora_inicio`,
    [desde, hasta]
  );

  const resumenPorEstado = rows.reduce((acc, row) => {
    acc[row.estado] = (acc[row.estado] || 0) + 1;
    return acc;
  }, {});

  return { citas: rows, resumenPorEstado };
}

// RF-REP-02: ingresos estimados (precio del servicio) de citas atendidas, agrupados
// por servicio y por barbero por separado.
export async function ingresosPorRango(desde, hasta) {
  const { rows: porServicio } = await query(
    `SELECT s.nombre AS servicio, COUNT(*) AS citas_atendidas, SUM(s.precio) AS ingresos
     FROM citas ci
     JOIN servicios s ON s.id = ci.servicio_id
     WHERE ci.estado = 'atendida' AND ci.fecha BETWEEN $1 AND $2
     GROUP BY s.nombre
     ORDER BY ingresos DESC`,
    [desde, hasta]
  );

  const { rows: porBarbero } = await query(
    `SELECT b.nombre AS barbero, COUNT(*) AS citas_atendidas, SUM(s.precio) AS ingresos
     FROM citas ci
     JOIN servicios s ON s.id = ci.servicio_id
     JOIN barberos b ON b.id = ci.barbero_id
     WHERE ci.estado = 'atendida' AND ci.fecha BETWEEN $1 AND $2
     GROUP BY b.nombre
     ORDER BY ingresos DESC`,
    [desde, hasta]
  );

  const totalIngresos = porServicio.reduce((sum, row) => sum + Number(row.ingresos), 0);

  return { porServicio, porBarbero, totalIngresos };
}

// RF-REP-03: consumo de insumos (movimientos tipo 'salida', es decir descontados por
// citas atendidas) por periodo, agrupado por insumo.
export async function consumoInsumosPorRango(desde, hasta) {
  const { rows } = await query(
    `SELECT i.nombre AS insumo, i.unidad_medida, SUM(m.cantidad) AS cantidad_consumida
     FROM insumo_movimientos m
     JOIN insumos i ON i.id = m.insumo_id
     WHERE m.tipo = 'salida' AND m.created_at::date BETWEEN $1 AND $2
     GROUP BY i.nombre, i.unidad_medida
     ORDER BY cantidad_consumida DESC`,
    [desde, hasta]
  );
  return { consumo: rows };
}
