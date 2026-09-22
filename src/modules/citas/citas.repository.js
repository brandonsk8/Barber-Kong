// Único lugar con acceso a datos de este módulo. SQL parametrizado a mano, sin ORM.
import { randomUUID } from 'node:crypto';
import { query } from '../../config/db.js';

const SELECT_DETALLE = `
  SELECT ci.*,
    s.nombre AS servicio_nombre, s.precio, s.duracion_minutos,
    b.nombre AS barbero_nombre,
    c.nombre AS cliente_nombre
  FROM citas ci
  JOIN servicios s ON s.id = ci.servicio_id
  JOIN barberos b ON b.id = ci.barbero_id
  LEFT JOIN clientes c ON c.id = ci.cliente_id
`;

export async function findServicioById(id) {
  const { rows } = await query('SELECT * FROM servicios WHERE id = $1', [id]);
  return rows[0] || null;
}

export async function findBarberoById(id) {
  const { rows } = await query('SELECT * FROM barberos WHERE id = $1', [id]);
  return rows[0] || null;
}

export async function findClienteByUserId(userId) {
  const { rows } = await query('SELECT * FROM clientes WHERE user_id = $1', [userId]);
  return rows[0] || null;
}

// UC-08/UC-25: walk-in con nombre pero sin cuenta — clientes.user_id queda NULL.
export async function createClienteWalkin(nombre) {
  const id = randomUUID();
  const { rows } = await query(
    `INSERT INTO clientes (id, nombre) VALUES ($1, $2) RETURNING *`,
    [id, nombre]
  );
  return rows[0];
}

// RF-CIT-07: no permitir doble reserva del mismo barbero. `excludeCitaId` se usa al
// reprogramar, para no chocar contra la cita que se está moviendo.
export async function existeSolapamiento(barberoId, fecha, horaInicio, horaFin, excludeCitaId = null) {
  const { rows } = await query(
    `SELECT 1 FROM citas
     WHERE barbero_id = $1 AND fecha = $2 AND estado != 'cancelada'
       AND (hora_inicio, hora_fin) OVERLAPS ($3::time, $4::time)
       AND ($5::uuid IS NULL OR id != $5)
     LIMIT 1`,
    [barberoId, fecha, horaInicio, horaFin, excludeCitaId]
  );
  return rows.length > 0;
}

export async function create({ clienteId, barberoId, servicioId, fecha, horaInicio, horaFin, esWalkin, estado }) {
  const id = randomUUID();
  await query(
    `INSERT INTO citas (id, cliente_id, barbero_id, servicio_id, fecha, hora_inicio, hora_fin, estado, es_walkin)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [id, clienteId, barberoId, servicioId, fecha, horaInicio, horaFin, estado, esWalkin]
  );
  return findById(id);
}

export async function findById(id) {
  const { rows } = await query(`${SELECT_DETALLE} WHERE ci.id = $1`, [id]);
  return rows[0] || null;
}

export async function findMiasByClienteId(clienteId) {
  const { rows } = await query(
    `${SELECT_DETALLE} WHERE ci.cliente_id = $1 ORDER BY ci.fecha DESC, ci.hora_inicio DESC`,
    [clienteId]
  );
  return rows;
}

export async function findByBarberoYFecha(barberoId, fecha) {
  const { rows } = await query(
    `${SELECT_DETALLE} WHERE ci.barbero_id = $1 AND ci.fecha = $2 ORDER BY ci.hora_inicio`,
    [barberoId, fecha]
  );
  return rows;
}

export async function findByRango({ desde, hasta, barberoId }) {
  const params = [desde, hasta];
  let sql = `${SELECT_DETALLE} WHERE ci.fecha BETWEEN $1 AND $2`;
  if (barberoId) {
    params.push(barberoId);
    sql += ` AND ci.barbero_id = $${params.length}`;
  }
  sql += ' ORDER BY ci.fecha, ci.hora_inicio';
  const { rows } = await query(sql, params);
  return rows;
}

export async function updateFechaHora(id, { fecha, horaInicio, horaFin }) {
  const { rows } = await query(
    `UPDATE citas SET fecha = $2, hora_inicio = $3, hora_fin = $4, updated_at = now()
     WHERE id = $1 RETURNING *`,
    [id, fecha, horaInicio, horaFin]
  );
  return rows[0] || null;
}

export async function setEstado(id, estado) {
  const { rows } = await query(
    `UPDATE citas SET estado = $2, updated_at = now() WHERE id = $1 RETURNING *`,
    [id, estado]
  );
  return rows[0] || null;
}

// Usada dentro de la transacción de "marcar como atendida" (UC-16) — mismo `client`
// que usa inventario.service.js para el descuento, así ambas escrituras se confirman
// juntas o ninguna.
export async function setEstadoTx(client, id, estado) {
  const { rows } = await client.query(
    `UPDATE citas SET estado = $2, updated_at = now() WHERE id = $1 RETURNING *`,
    [id, estado]
  );
  return rows[0] || null;
}
