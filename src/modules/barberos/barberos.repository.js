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

export async function createWithUser({ nombre, especialidad, email, passwordHash, horario }) {
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
    await insertarHorario(client, barberoId, horario);
    await client.query('COMMIT');
    return rows[0];
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function insertarHorario(client, barberoId, horario) {
  for (const bloque of horario) {
    await client.query(
      `INSERT INTO disponibilidad_barberos (id, barbero_id, dia_semana, hora_inicio, hora_fin)
       VALUES ($1, $2, $3, $4, $5)`,
      [randomUUID(), barberoId, bloque.dia_semana, bloque.hora_inicio, bloque.hora_fin]
    );
  }
}

// Datos del barbero y, si se manda `horario`, reemplazo completo de su horario semanal.
// Va en una transacción: si el horario falla, tampoco se guardan los datos (UC-23).
export async function update(id, { nombre, especialidad }, horario) {
  const client = await getClient();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `UPDATE barberos
       SET nombre = COALESCE($2, nombre), especialidad = COALESCE($3, especialidad), updated_at = now()
       WHERE id = $1
       RETURNING *`,
      [id, nombre, especialidad]
    );
    if (rows[0] && horario) {
      await client.query('DELETE FROM disponibilidad_barberos WHERE barbero_id = $1', [id]);
      await insertarHorario(client, id, horario);
    }
    await client.query('COMMIT');
    return rows[0] || null;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function findHorario(barberoId) {
  const { rows } = await query(
    `SELECT dia_semana, to_char(hora_inicio, 'HH24:MI') AS hora_inicio, to_char(hora_fin, 'HH24:MI') AS hora_fin
     FROM disponibilidad_barberos
     WHERE barbero_id = $1
     ORDER BY dia_semana, hora_inicio`,
    [barberoId]
  );
  return rows;
}

export async function findHorarioDelDia(barberoId, diaSemana) {
  const { rows } = await query(
    `SELECT to_char(hora_inicio, 'HH24:MI') AS hora_inicio, to_char(hora_fin, 'HH24:MI') AS hora_fin
     FROM disponibilidad_barberos
     WHERE barbero_id = $1 AND dia_semana = $2
     ORDER BY hora_inicio`,
    [barberoId, diaSemana]
  );
  return rows;
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
