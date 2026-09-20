// Único lugar con acceso a datos de este módulo. Alta de barbero implica crear también
// su `users` (role='barbero') porque en el esquema barberos.user_id es NOT NULL — se
// hace en una sola transacción para no dejar usuarios huérfanos sin perfil de barbero.
import { randomUUID } from 'node:crypto';
import { getClient, query } from '../../config/db.js';

export async function findAllActive() {
  const { rows } = await query(
    `SELECT b.id, b.nombre, b.especialidad, b.is_active, u.email
     FROM barberos b JOIN users u ON u.id = b.user_id
     WHERE b.is_active = TRUE
     ORDER BY b.nombre`
  );
  return rows;
}

export async function findAll() {
  const { rows } = await query(
    `SELECT b.id, b.nombre, b.especialidad, b.is_active, u.email
     FROM barberos b JOIN users u ON u.id = b.user_id
     ORDER BY b.nombre`
  );
  return rows;
}

export async function findById(id) {
  const { rows } = await query(
    `SELECT b.id, b.nombre, b.especialidad, b.is_active, b.user_id, u.email
     FROM barberos b JOIN users u ON u.id = b.user_id
     WHERE b.id = $1`,
    [id]
  );
  return rows[0] || null;
}

export async function findByUserId(userId) {
  const { rows } = await query('SELECT * FROM barberos WHERE user_id = $1', [userId]);
  return rows[0] || null;
}

export async function createWithUser({ nombre, especialidad, email, passwordHash }) {
  const client = await getClient();
  try {
    await client.query('BEGIN');
    const userId = randomUUID();
    await client.query(
      `INSERT INTO users (id, email, password_hash, role) VALUES ($1, $2, $3, 'barbero')`,
      [userId, email, passwordHash]
    );
    const barberoId = randomUUID();
    const { rows } = await client.query(
      `INSERT INTO barberos (id, user_id, nombre, especialidad) VALUES ($1, $2, $3, $4) RETURNING *`,
      [barberoId, userId, nombre, especialidad || null]
    );
    // Horario por defecto de la barbería: domingo(0) a jueves(4), 9:00-19:00.
    for (const dia of [0, 1, 2, 3, 4]) {
      await client.query(
        `INSERT INTO disponibilidad_barberos (id, barbero_id, dia_semana, hora_inicio, hora_fin)
         VALUES ($1, $2, $3, '09:00', '19:00')`,
        [randomUUID(), barberoId, dia]
      );
    }
    await client.query('COMMIT');
    return rows[0];
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function update(id, { nombre, especialidad }) {
  const { rows } = await query(
    `UPDATE barberos
     SET nombre = COALESCE($2, nombre), especialidad = COALESCE($3, especialidad), updated_at = now()
     WHERE id = $1
     RETURNING *`,
    [id, nombre, especialidad]
  );
  return rows[0] || null;
}

export async function setActive(id, isActive) {
  const { rows } = await query(
    `UPDATE barberos SET is_active = $2, updated_at = now() WHERE id = $1 RETURNING *`,
    [id, isActive]
  );
  return rows[0] || null;
}

// Citas no canceladas de un barbero en una fecha, para calcular disponibilidad.
export async function findCitasDelDia(barberoId, fecha) {
  const { rows } = await query(
    `SELECT hora_inicio, hora_fin FROM citas
     WHERE barbero_id = $1 AND fecha = $2 AND estado != 'cancelada'`,
    [barberoId, fecha]
  );
  return rows;
}
