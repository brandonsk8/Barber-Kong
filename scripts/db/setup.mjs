#!/usr/bin/env node
// Crea la base de datos en el Postgres local (si no existe), aplica las migraciones
// versionadas de resources/db/migrations/*.sql y siembra resources/db/seed.sql. Sin
// Docker, sin ORM: asume que ya tienes un servidor Postgres corriendo localmente y
// credenciales con permiso de CREATEDB (el usuario de tu instalación local sirve).
//
// Uso:
//   npm run db:setup           -> crea/actualiza el esquema (migraciones) y siembra datos de ejemplo
//   npm run db:reset           -> DROP + recrea todo desde cero
//   npm run db:migrate         -> solo aplica migraciones pendientes, sin seed
//
// Variables de entorno esperadas (ver .env.example): DB_HOST, DB_PORT, DB_NAME, DB_USER,
// DB_PASSWORD, NODE_ENV.

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { runMigrations } from './migrate.mjs';

const { Client } = pg;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbResourcesDir = path.resolve(__dirname, '../../resources/db');

const RESET = process.argv.includes('--reset');
const SKIP_SEED = process.argv.includes('--no-seed') || process.env.NODE_ENV === 'production';

const dbName = process.env.DB_NAME;
if (!dbName || !/^[a-zA-Z0-9_]+$/.test(dbName)) {
  console.error(`DB_NAME inválido o no definido: "${dbName}". Debe ser solo letras/números/guion bajo.`);
  process.exit(1);
}

const baseConfig = {
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT) || 5432,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
};

async function ensureDatabaseExists() {
  const client = new Client({ ...baseConfig, database: 'postgres' });
  await client.connect();
  try {
    const { rowCount } = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [dbName]);
    if (rowCount === 0) {
      // CREATE DATABASE no admite parámetros; dbName ya se validó arriba contra un allowlist.
      await client.query(`CREATE DATABASE "${dbName}"`);
      console.log(`Base de datos "${dbName}" creada.`);
    } else {
      console.log(`Base de datos "${dbName}" ya existe.`);
    }
  } finally {
    await client.end();
  }
}

async function applyResetIfRequested(client) {
  if (!RESET) return;
  console.log('Reseteando esquema (--reset): DROP SCHEMA public CASCADE...');
  await client.query('DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;');
}

async function runSqlFile(client, filename) {
  const filePath = path.join(dbResourcesDir, filename);
  const sql = await fs.readFile(filePath, 'utf8');
  console.log(`Aplicando ${filename}...`);
  await client.query(sql);
}

async function main() {
  await ensureDatabaseExists();

  const client = new Client({ ...baseConfig, database: dbName });
  await client.connect();
  try {
    await applyResetIfRequested(client);
    await runMigrations(client);

    if (SKIP_SEED) {
      console.log('Seed omitido (--no-seed o NODE_ENV=production).');
    } else {
      await runSqlFile(client, 'seed.sql');
    }

    console.log('Listo.');
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error('Error al preparar la base de datos:', err);
  process.exit(1);
});
