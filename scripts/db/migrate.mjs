// Runner de migraciones versionadas — sin ORM, sin librería externa de migraciones.
// Cada archivo en resources/db/migrations/NNNN_descripcion.sql es idempotente
// (CREATE ... IF NOT EXISTS) y se aplica como máximo una vez, registrado en
// `schema_migrations` junto con el checksum SHA-256 de su contenido.

import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const migrationsDir = path.resolve(__dirname, '../../resources/db/migrations');

export const MIGRATION_FILE_PATTERN = /^(\d{4})_[a-z0-9_]+\.sql$/;

// Clave arbitraria pero fija para pg_advisory_lock; identifica "el runner de
// migraciones de Barber Kong" dentro de la base de datos.
const LOCK_KEY = 2026_0919;

// Normaliza fin de línea para que un checkout en Windows (CRLF) no se vea como "editado".
function checksum(sql) {
  return crypto.createHash('sha256').update(sql.replace(/\r\n/g, '\n')).digest('hex');
}

export async function readMigrationFiles() {
  const sqlFiles = (await fs.readdir(migrationsDir)).filter((f) => f.endsWith('.sql')).sort();

  const invalid = sqlFiles.filter((f) => !MIGRATION_FILE_PATTERN.test(f));
  if (invalid.length > 0) {
    throw new Error(
      `Nombres de migración inválidos (se espera NNNN_descripcion.sql en minúsculas): ${invalid.join(', ')}`
    );
  }

  const byNumber = new Map();
  for (const file of sqlFiles) {
    const number = file.slice(0, 4);
    if (byNumber.has(number)) {
      throw new Error(
        `Número de migración repetido ${number}: ${byNumber.get(number)} y ${file}. Renumera la más nueva.`
      );
    }
    byNumber.set(number, file);
  }

  return Promise.all(
    sqlFiles.map(async (version) => {
      const sql = await fs.readFile(path.join(migrationsDir, version), 'utf8');
      return { version, sql, checksum: checksum(sql) };
    })
  );
}

async function ensureMigrationsTable(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version     VARCHAR(255) PRIMARY KEY,
      applied_at  TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    ALTER TABLE schema_migrations ADD COLUMN IF NOT EXISTS checksum CHAR(64);
    ALTER TABLE schema_migrations ADD COLUMN IF NOT EXISTS execution_ms INTEGER;
  `);
}

// Compara archivos vs. tabla. Estados: applied, pending, modified (checksum distinto),
// missing (registrada en la BD pero el archivo ya no existe en el repo).
export async function getMigrationStatus(client) {
  await ensureMigrationsTable(client);

  const files = await readMigrationFiles();
  const { rows } = await client.query(
    'SELECT version, checksum, applied_at FROM schema_migrations ORDER BY version'
  );
  const appliedByVersion = new Map(rows.map((r) => [r.version, r]));

  const status = files.map((file) => {
    const applied = appliedByVersion.get(file.version);
    if (!applied) return { ...file, state: 'pending' };
    // Filas de antes de que existiera la columna checksum: se adoptan en runMigrations().
    if (applied.checksum && applied.checksum !== file.checksum) {
      return { ...file, state: 'modified', appliedAt: applied.applied_at };
    }
    return { ...file, state: 'applied', appliedAt: applied.applied_at, legacy: !applied.checksum };
  });

  const fileVersions = new Set(files.map((f) => f.version));
  for (const row of rows) {
    if (!fileVersions.has(row.version)) {
      status.push({ version: row.version, state: 'missing', appliedAt: row.applied_at });
    }
  }

  return status;
}

export async function runMigrations(client) {
  await client.query('SELECT pg_advisory_lock($1)', [LOCK_KEY]);
  try {
    const status = await getMigrationStatus(client);

    const modified = status.filter((m) => m.state === 'modified');
    if (modified.length > 0) {
      throw new Error(
        `Migraciones ya aplicadas fueron editadas: ${modified.map((m) => m.version).join(', ')}. ` +
          'Revierte el cambio y crea una migración nueva (npm run db:new -- <descripcion>).'
      );
    }

    for (const m of status.filter((s) => s.state === 'missing')) {
      console.warn(`Aviso: ${m.version} está aplicada en la BD pero ya no existe en el repo.`);
    }

    for (const m of status.filter((s) => s.state === 'applied' && s.legacy)) {
      await client.query('UPDATE schema_migrations SET checksum = $1 WHERE version = $2', [
        m.checksum,
        m.version,
      ]);
    }

    const lastApplied = status.filter((s) => s.state === 'applied').map((s) => s.version).pop();
    const pending = status.filter((s) => s.state === 'pending');

    if (pending.length === 0) {
      console.log('Sin migraciones pendientes.');
      return;
    }

    for (const m of pending) {
      if (lastApplied && m.version < lastApplied) {
        console.warn(`Aviso: ${m.version} se aplica fuera de orden (la última aplicada es ${lastApplied}).`);
      }

      console.log(`Aplicando migración: ${m.version}`);
      const startedAt = Date.now();
      try {
        await client.query('BEGIN');
        await client.query(m.sql);
        await client.query(
          'INSERT INTO schema_migrations (version, checksum, execution_ms) VALUES ($1, $2, $3)',
          [m.version, m.checksum, Date.now() - startedAt]
        );
        await client.query('COMMIT');
      } catch (err) {
        await client.query('ROLLBACK');
        throw new Error(`Falló la migración ${m.version}: ${err.message}`);
      }
    }

    console.log(`${pending.length} migración(es) aplicada(s).`);
  } finally {
    await client.query('SELECT pg_advisory_unlock($1)', [LOCK_KEY]);
  }
}

function printStatus(status) {
  const labels = {
    applied: 'aplicada ',
    pending: 'PENDIENTE',
    modified: 'EDITADA  ',
    missing: 'SIN ARCHIVO',
  };
  for (const m of status) {
    const when = m.appliedAt ? `  ${m.appliedAt.toISOString()}` : '';
    console.log(`  ${labels[m.state]}  ${m.version}${when}`);
  }
  const pending = status.filter((m) => m.state === 'pending').length;
  console.log(`\n${status.length} migración(es), ${pending} pendiente(s).`);
}

// Permite correrlo suelto: node scripts/db/migrate.mjs [status]
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
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
    if (process.argv[2] === 'status') {
      printStatus(await getMigrationStatus(client));
    } else {
      await runMigrations(client);
      console.log('Migraciones al día.');
    }
  } catch (err) {
    console.error(err.message);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}
