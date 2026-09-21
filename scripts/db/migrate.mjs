// Runner de migraciones versionadas — sin ORM, sin librería externa de migraciones.
// Cada archivo en resources/db/migrations/*.sql es idempotente (CREATE ... IF NOT
// EXISTS) y se aplica como máximo una vez, registrado en `schema_migrations`.
// Uso directo: node scripts/db/migrate.mjs (requiere una conexión ya abierta si se
// importa como módulo; ver runMigrations()). También se invoca desde setup.mjs.

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationsDir = path.resolve(__dirname, '../../resources/db/migrations');

export async function runMigrations(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version     VARCHAR(255) PRIMARY KEY,
      applied_at  TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);

  const { rows } = await client.query('SELECT version FROM schema_migrations');
  const applied = new Set(rows.map((r) => r.version));

  const files = (await fs.readdir(migrationsDir))
    .filter((f) => f.endsWith('.sql'))
    .sort();

  for (const file of files) {
    if (applied.has(file)) continue;

    const sql = await fs.readFile(path.join(migrationsDir, file), 'utf8');
    console.log(`Aplicando migración: ${file}`);
    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query('INSERT INTO schema_migrations (version) VALUES ($1)', [file]);
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw new Error(`Falló la migración ${file}: ${err.message}`);
    }
  }
}

// Permite correrlo suelto: node scripts/db/migrate.mjs
if (import.meta.url === `file://${process.argv[1]}`) {
  const pg = await import('pg');
  const { Client } = pg.default;

  const client = new Client({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT) || 5432,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });

  await client.connect();
  try {
    await runMigrations(client);
    console.log('Migraciones al día.');
  } catch (err) {
    console.error(err.message);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}
