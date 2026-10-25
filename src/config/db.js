// Único punto de acceso a Postgres. Sin ORM: cada módulo escribe su propio SQL
// parametrizado en su `*.repository.js` y usa `query`/`getClient` de aquí.
import pg from 'pg';
import { logger } from './logger.js';

const { Pool, types } = pg;

// Por defecto, node-postgres parsea las columnas DATE (oid 1082) a un objeto Date de
// JS en hora UTC, que al pasar por res.json() sale como "2026-09-21T00:00:00.000Z".
// El frontend espera fechas simples "YYYY-MM-DD" (ver utils/date.js), así que dejamos
// el valor tal cual lo manda Postgres, sin conversión a Date.
types.setTypeParser(types.builtins.DATE, (value) => value);

// DB_SSL=true habilita TLS — necesario para Supabase (y la mayoría de Postgres
// administrados en la nube). Se deja apagado por defecto para no romper el Postgres
// local ni el de docker-compose, que no usan TLS. rejectUnauthorized:false porque el
// certificado del connection pooler de Supabase no siempre valida contra la CA por
// defecto de Node — la conexión igual viaja cifrada, solo no se verifica la cadena
// completa (aceptable acá: no es tráfico público, es backend -> BD administrada).
const ssl = process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined;

export const pool = new Pool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  // En Vercel cada invocación de función serverless puede abrir su propio pool; uno
  // chico (DB_POOL_MAX=1 recomendado ahí) evita agotar las conexiones del transaction
  // pooler de Supabase bajo carga concurrente. Sin definir, usa el default de `pg` (10),
  // que es lo correcto para un proceso long-lived como en local/Docker.
  max: process.env.DB_POOL_MAX ? Number(process.env.DB_POOL_MAX) : undefined,
  ssl,
});

pool.on('error', (err) => {
  // Error en un cliente inactivo del pool (p. ej. la conexión se cayó). No debe tumbar
  // el proceso completo; se registra y el pool reemplaza el cliente en la próxima query.
  logger.error('Error inesperado en el pool de Postgres', { error: err.message });
});

// Úsalo para lecturas/escrituras sueltas: query('SELECT * FROM servicios WHERE id = $1', [id])
export function query(text, params) {
  return pool.query(text, params);
}

// Úsalo cuando necesites varias sentencias en una sola transacción (p. ej. UC-16:
// marcar cita como atendida + descontar inventario deben confirmarse juntos o no
// confirmarse ninguno). El caller es responsable de BEGIN/COMMIT/ROLLBACK y de
// liberar el cliente con client.release() en un finally.
export async function getClient() {
  return pool.connect();
}
