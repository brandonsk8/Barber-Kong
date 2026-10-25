// Datos de prueba reales en la base *_test. Todo lo que se crea lleva el prefijo PREFIJO
// para poder borrarlo sin tocar el seed ni datos ajenos; cada prueba usa nombres únicos.
import { randomUUID } from 'node:crypto';
import bcrypt from 'bcrypt';
import request from 'supertest';
import { createApp } from '../../src/server/app.js';
import { pool, query } from '../../src/config/db.js';

export const PREFIJO = 'zz-test';
export const PASSWORD = 'Prueba123!';
const HASH = bcrypt.hashSync(PASSWORD, 4); // costo bajo: solo para que las pruebas sean rápidas

let app;
export async function getApp() {
  app ||= await createApp();
  return app;
}

export const unico = (base) => `${PREFIJO}-${base}-${randomUUID().slice(0, 8)}`;

// YYYY-MM-DD de dentro de `dias` días (lejos de hoy para no rozar husos horarios).
export function fechaEn(dias) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

export async function crearUsuario({ role, nombre = unico(role), twoFactor = false }) {
  const id = randomUUID();
  const email = `${nombre}@test.local`;
  await query(
    'INSERT INTO users (id, email, password_hash, role, two_factor_enabled) VALUES ($1, $2, $3, $4, $5)',
    [id, email, HASH, role, twoFactor]
  );
  let perfilId = null;
  if (role === 'cliente') {
    perfilId = randomUUID();
    await query('INSERT INTO clientes (id, user_id, nombre, correo) VALUES ($1, $2, $3, $4)', [perfilId, id, nombre, email]);
  }
  if (role === 'barbero') {
    perfilId = randomUUID();
    await query('INSERT INTO barberos (id, user_id, nombre) VALUES ($1, $2, $3)', [perfilId, id, nombre]);
    // Atiende los 7 días, 09:00-13:00 y 14:00-19:00: la fecha de la prueba no importa.
    for (let dia = 0; dia < 7; dia++) {
      for (const [ini, fin] of [['09:00', '13:00'], ['14:00', '19:00']]) {
        await query(
          'INSERT INTO disponibilidad_barberos (id, barbero_id, dia_semana, hora_inicio, hora_fin) VALUES ($1, $2, $3, $4, $5)',
          [randomUUID(), perfilId, dia, ini, fin]
        );
      }
    }
  }
  return { id, email, nombre, password: PASSWORD, perfilId };
}

export async function crearServicio({ duracion = 30, precio = 50 } = {}) {
  const id = randomUUID();
  const nombre = unico('servicio');
  await query('INSERT INTO servicios (id, nombre, duracion_minutos, precio) VALUES ($1, $2, $3, $4)', [id, nombre, duracion, precio]);
  return { id, nombre };
}

export async function crearInsumo({ disponible = 10, minimo = 2 } = {}) {
  const id = randomUUID();
  const nombre = unico('insumo');
  await query(
    'INSERT INTO insumos (id, nombre, unidad_medida, cantidad_disponible, cantidad_minima) VALUES ($1, $2, $3, $4, $5)',
    [id, nombre, 'frasco', disponible, minimo]
  );
  return { id, nombre };
}

export async function asociarInsumo(servicioId, insumoId, cantidad) {
  await query(
    'INSERT INTO servicio_insumos (id, servicio_id, insumo_id, cantidad_consumida) VALUES ($1, $2, $3, $4)',
    [randomUUID(), servicioId, insumoId, cantidad]
  );
}

export async function login(usuario) {
  const res = await request(await getApp()).post('/api/auth/login').send({ email: usuario.email, password: usuario.password });
  if (res.status !== 200) throw new Error(`Login de prueba falló (${res.status}): ${JSON.stringify(res.body)}`);
  return { Authorization: `Bearer ${res.body.token}` };
}

export const stockDe = async (insumoId) =>
  Number((await query('SELECT cantidad_disponible FROM insumos WHERE id = $1', [insumoId])).rows[0].cantidad_disponible);

// Borra lo creado por las pruebas, en el orden que piden las llaves foráneas.
export async function limpiar() {
  const like = `${PREFIJO}-%`;
  await query(
    `DELETE FROM citas WHERE barbero_id IN (SELECT id FROM barberos WHERE nombre LIKE $1)
        OR servicio_id IN (SELECT id FROM servicios WHERE nombre LIKE $1)
        OR cliente_id IN (SELECT id FROM clientes WHERE nombre LIKE $1)`,
    [like]
  );
  await query('DELETE FROM servicios WHERE nombre LIKE $1', [like]);
  await query('DELETE FROM insumos WHERE nombre LIKE $1', [like]);
  await query('DELETE FROM barberos WHERE nombre LIKE $1', [like]);
  await query('DELETE FROM clientes WHERE nombre LIKE $1', [like]);
  await query(`DELETE FROM users WHERE email LIKE $1`, [`${PREFIJO}-%@test.local`]);
  // Notificaciones de usuarios que ya no existen se borran en cascada con el usuario.
}

export async function cerrar() {
  await limpiar();
  await pool.end();
}
