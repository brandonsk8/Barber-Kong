// Único lugar con acceso a datos de este módulo. SQL parametrizado a mano, sin ORM:
// si necesitas otra consulta, agrégala aquí como otra función exportada — no metas
// SQL en el service ni en el controller.
import { randomUUID } from 'node:crypto';
import { query } from '../../config/db.js';

export async function findAllActive() {
  const { rows } = await query('SELECT * FROM servicios WHERE is_active = TRUE ORDER BY nombre');
  return rows;
}

export async function findById(id) {
  const { rows } = await query('SELECT * FROM servicios WHERE id = $1', [id]);
  return rows[0] || null;
}

export async function create({ nombre, duracion_minutos, precio }) {
  const id = randomUUID();
  const { rows } = await query(
    `INSERT INTO servicios (id, nombre, duracion_minutos, precio)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [id, nombre, duracion_minutos, precio]
  );
  return rows[0];
}

export async function update(id, { nombre, duracion_minutos, precio }) {
  const { rows } = await query(
    `UPDATE servicios
     SET nombre = COALESCE($2, nombre),
         duracion_minutos = COALESCE($3, duracion_minutos),
         precio = COALESCE($4, precio),
         updated_at = now()
     WHERE id = $1
     RETURNING *`,
    [id, nombre, duracion_minutos, precio]
  );
  return rows[0] || null;
}

export async function setActive(id, isActive) {
  const { rows } = await query(
    `UPDATE servicios SET is_active = $2, updated_at = now() WHERE id = $1 RETURNING *`,
    [id, isActive]
  );
  return rows[0] || null;
}

// --- UC-13: asociar insumos a servicio --------------------------------------------
export async function findInsumosDelServicio(servicioId) {
  const { rows } = await query(
    `SELECT si.insumo_id, si.cantidad_consumida, i.nombre, i.unidad_medida
     FROM servicio_insumos si
     JOIN insumos i ON i.id = si.insumo_id
     WHERE si.servicio_id = $1
     ORDER BY i.nombre`,
    [servicioId]
  );
  return rows;
}

// Upsert: si el insumo ya estaba asociado, solo actualiza la cantidad (no hace falta
// quitarlo primero para corregir un valor).
export async function asociarInsumo(servicioId, insumoId, cantidadConsumida) {
  const { rows } = await query(
    `INSERT INTO servicio_insumos (id, servicio_id, insumo_id, cantidad_consumida)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (servicio_id, insumo_id)
     DO UPDATE SET cantidad_consumida = excluded.cantidad_consumida, updated_at = now()
     RETURNING *`,
    [randomUUID(), servicioId, insumoId, cantidadConsumida]
  );
  return rows[0];
}

export async function quitarInsumo(servicioId, insumoId) {
  const { rowCount } = await query(
    `DELETE FROM servicio_insumos WHERE servicio_id = $1 AND insumo_id = $2`,
    [servicioId, insumoId]
  );
  return rowCount > 0;
}
