// Único lugar con acceso a datos de este módulo. Los clientes walk-in que llega a
// registrar el admin no tienen user_id (login); los que se registran ellos mismos sí
// (ver auth.service.js#register, que crea la fila de clientes al crear la cuenta).
import { randomUUID } from 'node:crypto';
import { query } from '../../config/db.js';

const BASE_SELECT = `
  SELECT c.*,
    (SELECT COUNT(*) FROM citas ci WHERE ci.cliente_id = c.id) AS citas_totales,
    (SELECT MAX(ci.fecha) FROM citas ci WHERE ci.cliente_id = c.id) AS ultima_visita
  FROM clientes c
`;

export async function findAll(search) {
  if (search) {
    const { rows } = await query(
      `${BASE_SELECT} WHERE c.is_active = TRUE AND (c.nombre ILIKE $1 OR c.telefono ILIKE $1)
       ORDER BY c.nombre`,
      [`%${search}%`]
    );
    return rows;
  }
  const { rows } = await query(`${BASE_SELECT} WHERE c.is_active = TRUE ORDER BY c.nombre`);
  return rows;
}

export async function findById(id) {
  const { rows } = await query(`${BASE_SELECT} WHERE c.id = $1`, [id]);
  return rows[0] || null;
}

export async function findByUserId(userId) {
  const { rows } = await query('SELECT * FROM clientes WHERE user_id = $1', [userId]);
  return rows[0] || null;
}

export async function create({ nombre, telefono, correo }) {
  const id = randomUUID();
  const { rows } = await query(
    `INSERT INTO clientes (id, nombre, telefono, correo) VALUES ($1, $2, $3, $4) RETURNING *`,
    [id, nombre, telefono || null, correo || null]
  );
  return rows[0];
}

export async function update(id, { nombre, telefono, correo }) {
  const { rows } = await query(
    `UPDATE clientes
     SET nombre = COALESCE($2, nombre), telefono = COALESCE($3, telefono),
         correo = COALESCE($4, correo), updated_at = now()
     WHERE id = $1
     RETURNING *`,
    [id, nombre, telefono, correo]
  );
  return rows[0] || null;
}

export async function setActive(id, isActive) {
  const { rows } = await query(
    `UPDATE clientes SET is_active = $2, updated_at = now() WHERE id = $1 RETURNING *`,
    [id, isActive]
  );
  return rows[0] || null;
}

// UC-10: historial de citas y servicios recibidos por el cliente.
export async function findHistorial(id) {
  const { rows } = await query(
    `SELECT c.id, c.fecha, c.hora_inicio, c.hora_fin, c.estado, c.es_walkin,
            s.nombre AS servicio, b.nombre AS barbero
     FROM citas c
     JOIN servicios s ON s.id = c.servicio_id
     JOIN barberos b ON b.id = c.barbero_id
     WHERE c.cliente_id = $1
     ORDER BY c.fecha DESC, c.hora_inicio DESC`,
    [id]
  );
  return rows;
}
