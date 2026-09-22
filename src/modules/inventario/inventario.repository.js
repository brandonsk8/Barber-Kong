// Único lugar con acceso a datos de este módulo. Las funciones *Tx reciben un client
// de transacción ya abierto (ver src/config/db.js#getClient) porque participan en la
// transacción de "cita atendida -> descuento de insumos" que arma citas.service.js
// (dueño: EP-02) — no abren su propia conexión.
import { randomUUID } from 'node:crypto';
import { query } from '../../config/db.js';

export async function findAll() {
  const { rows } = await query('SELECT * FROM insumos ORDER BY nombre');
  return rows;
}

export async function findById(id) {
  const { rows } = await query('SELECT * FROM insumos WHERE id = $1', [id]);
  return rows[0] || null;
}

export async function create({ nombre, unidad_medida, cantidad_minima }) {
  const id = randomUUID();
  const { rows } = await query(
    `INSERT INTO insumos (id, nombre, unidad_medida, cantidad_minima)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [id, nombre, unidad_medida, cantidad_minima ?? null]
  );
  return rows[0];
}

export async function update(id, { nombre, unidad_medida, cantidad_minima }) {
  const { rows } = await query(
    `UPDATE insumos
     SET nombre = COALESCE($2, nombre),
         unidad_medida = COALESCE($3, unidad_medida),
         cantidad_minima = COALESCE($4, cantidad_minima),
         updated_at = now()
     WHERE id = $1
     RETURNING *`,
    [id, nombre, unidad_medida, cantidad_minima]
  );
  return rows[0] || null;
}

// UC-15: reabastecimiento. Transacción propia (no participa de la de citas).
export async function registrarEntrada(id, cantidad) {
  const { rows } = await query(
    `UPDATE insumos SET cantidad_disponible = cantidad_disponible + $2, updated_at = now()
     WHERE id = $1 RETURNING *`,
    [id, cantidad]
  );
  if (!rows[0]) return null;
  await query(
    `INSERT INTO insumo_movimientos (id, insumo_id, tipo, cantidad) VALUES ($1, $2, 'entrada', $3)`,
    [randomUUID(), id, cantidad]
  );
  return rows[0];
}

// --- Usadas dentro de la transacción de citas (UC-16) -----------------------------
export async function findServicioInsumosTx(client, servicioId) {
  const { rows } = await client.query(
    `SELECT insumo_id, cantidad_consumida FROM servicio_insumos WHERE servicio_id = $1`,
    [servicioId]
  );
  return rows;
}

export async function descontarInsumoTx(client, insumoId, cantidad, citaId) {
  const { rows } = await client.query(
    `UPDATE insumos SET cantidad_disponible = cantidad_disponible - $2, updated_at = now()
     WHERE id = $1 RETURNING *`,
    [insumoId, cantidad]
  );
  await client.query(
    `INSERT INTO insumo_movimientos (id, insumo_id, cita_id, tipo, cantidad) VALUES ($1, $2, $3, 'salida', $4)`,
    [randomUUID(), insumoId, citaId, cantidad]
  );
  return rows[0];
}

export async function findAdminUsers() {
  const { rows } = await query(`SELECT id, email FROM users WHERE role = 'admin' AND is_active = TRUE`);
  return rows;
}
