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
